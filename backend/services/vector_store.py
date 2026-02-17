"""
ChromaDB Vector Store — Embed underwriting guidelines, claim narratives, and decisions for RAG
"""
import os
import chromadb
from chromadb.config import Settings
from typing import List, Optional

# Use OpenAI embeddings if key is available, else a simple fallback
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
CHROMA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "chroma_db")

_client: Optional[chromadb.ClientAPI] = None
_collection = None
_knowledge_collection = None


def _get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=os.path.abspath(CHROMA_DIR))
    return _client


def _make_ef():
    """Return OpenAI embedding function if key available, else None (default)."""
    if OPENAI_KEY and OPENAI_KEY != "your-openai-api-key-here":
        from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
        return OpenAIEmbeddingFunction(api_key=OPENAI_KEY, model_name="text-embedding-3-small")
    return None


def get_collection():
    global _collection
    if _collection is None:
        client = _get_client()
        ef = _make_ef()
        kwargs = {"name": "guidelines"}
        if ef:
            kwargs["embedding_function"] = ef
        _collection = client.get_or_create_collection(**kwargs)
    return _collection


def get_knowledge_collection():
    """Separate collection for claim descriptions + decision reasons (semantic search)."""
    global _knowledge_collection
    if _knowledge_collection is None:
        client = _get_client()
        ef = _make_ef()
        kwargs = {"name": "knowledge"}
        if ef:
            kwargs["embedding_function"] = ef
        _knowledge_collection = client.get_or_create_collection(**kwargs)
    return _knowledge_collection


async def index_guidelines(db_session):
    """Load guidelines from SQLite and index into ChromaDB."""
    from sqlalchemy import text
    result = await db_session.execute(
        text("SELECT id, section_code, title, content, category FROM guidelines")
    )
    rows = result.fetchall()
    if not rows:
        print("[Vector Store] No guidelines found in DB to index.")
        return 0

    collection = get_collection()

    # Check if already indexed
    existing = collection.count()
    if existing >= len(rows):
        print(f"[Vector Store] Already indexed {existing} guidelines. Skipping.")
        return existing

    ids = []
    documents = []
    metadatas = []

    for row in rows:
        gid, section, title, content, category = row
        doc_id = f"guideline_{gid}"
        ids.append(doc_id)
        documents.append(f"Section {section} — {title}: {content}")
        metadatas.append({
            "section_code": section,
            "title": title,
            "category": category or ""
        })

    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    print(f"[Vector Store] Indexed {len(ids)} guidelines into ChromaDB.")
    return len(ids)


async def index_claims_and_decisions(db_session) -> tuple:
    """Index claim descriptions and decision reasons into ChromaDB knowledge collection.
    Called at startup so underwriters can semantically search past cases."""
    from sqlalchemy import text

    knowledge = get_knowledge_collection()
    ids, docs, metas = [], [], []

    # ── Claims: description text ──────────────────────────────────────────────
    result = await db_session.execute(text("""
        SELECT c.id, c.claim_number, c.claim_type, c.claim_amount,
               c.description, c.status, c.claim_date,
               p.policy_number, p.policyholder_name, p.industry_type
        FROM claims c
        JOIN policies p ON c.policy_id = p.id
        WHERE c.description IS NOT NULL AND trim(c.description) != ''
    """))
    claims = result.fetchall()
    for row in claims:
        cid, cnum, ctype, amount, desc, status, cdate, pnum, pname, industry = row
        doc = (
            f"{ctype or 'General'} claim on policy {pnum} ({pname}, {industry}). "
            f"Date: {cdate}. Amount: ${float(amount or 0):,.2f}. Status: {status}. "
            f"Details: {desc}"
        )
        ids.append(f"claim_{cid}")
        docs.append(doc)
        metas.append({
            "type": "claim",
            "claim_number": str(cnum or ""),
            "claim_type": str(ctype or ""),
            "policy_number": str(pnum or ""),
            "policyholder": str(pname or ""),
            "industry": str(industry or ""),
            "amount": float(amount or 0),
            "status": str(status or ""),
        })

    # ── Decisions: reason text ────────────────────────────────────────────────
    result = await db_session.execute(text("""
        SELECT id, policy_number, decision, reason, risk_level, decided_by, created_at
        FROM decisions
        WHERE reason IS NOT NULL AND trim(reason) != ''
    """))
    decisions = result.fetchall()
    for row in decisions:
        did, pnum, dec, reason, risk, decider, created = row
        doc = (
            f"Underwriting decision for {pnum}: {str(dec or '').upper()} "
            f"(Risk level: {risk}). "
            f"Decided by {decider} on {created}. "
            f"Reason: {reason}"
        )
        ids.append(f"decision_{did}")
        docs.append(doc)
        metas.append({
            "type": "decision",
            "policy_number": str(pnum or ""),
            "decision": str(dec or ""),
            "risk_level": str(risk or ""),
            "decided_by": str(decider or ""),
        })

    if ids:
        knowledge.upsert(ids=ids, documents=docs, metadatas=metas)
        print(f"[Vector Store] Indexed {len(claims)} claims + {len(decisions)} decisions into knowledge base.")
    else:
        print("[Vector Store] No claim/decision text found to index.")

    return len(claims), len(decisions)


def search_knowledge(query: str, k: int = 4, doc_type: Optional[str] = None) -> List[dict]:
    """Semantic search over claim descriptions and past decisions.
    doc_type: 'claim' | 'decision' | None (both)
    """
    collection = get_knowledge_collection()
    if collection.count() == 0:
        return []

    try:
        query_kwargs = {
            "query_texts": [query],
            "n_results": min(k, collection.count()),
        }
        if doc_type:
            query_kwargs["where"] = {"type": doc_type}
        results = collection.query(**query_kwargs)
    except Exception as e:
        print(f"[Vector Store] knowledge search error: {e}")
        return []

    matches = []
    if results and results["documents"]:
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            dist = results["distances"][0][i] if results["distances"] else 1
            score = round(1 - dist, 3)
            if score < 0.1:   # Skip very distant results
                continue
            matches.append({
                "type": meta.get("type", ""),
                "policy_number": meta.get("policy_number", ""),
                "content": doc,
                "score": score,
                **{k: v for k, v in meta.items() if k not in ("type", "policy_number")},
            })
    return matches


def search_similar(query: str, k: int = 5, policy_number: Optional[str] = None) -> List[dict]:
    """Search ChromaDB for guidelines similar to the query."""
    collection = get_collection()
    if collection.count() == 0:
        return []

    results = collection.query(query_texts=[query], n_results=min(k, collection.count()))

    matches = []
    if results and results["documents"]:
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            dist = results["distances"][0][i] if results["distances"] else 0
            if policy_number and meta.get("policy_number") not in {policy_number, None, ""}:
                continue
            matches.append({
                "section": meta.get("section_code", ""),
                "title": meta.get("title", ""),
                "content": doc,
                "score": 1 - dist,  # Convert distance to similarity
                "policy_number": meta.get("policy_number")
            })

    return matches


async def upsert_guideline(guideline) -> None:
    """Add or update a single guideline in ChromaDB."""
    collection = get_collection()
    doc_id = f"guideline_{guideline.id}"
    document = f"Section {guideline.section_code} — {guideline.title}: {guideline.content}"
    metadata = {
        "section_code": guideline.section_code,
        "title": guideline.title,
        "category": guideline.category or "",
        "policy_number": guideline.policy_number or ""
    }
    collection.upsert(ids=[doc_id], documents=[document], metadatas=[metadata])
