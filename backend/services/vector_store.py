"""
ChromaDB Vector Store — Embed underwriting guidelines for RAG retrieval
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


def _get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=os.path.abspath(CHROMA_DIR))
    return _client


def get_collection():
    global _collection
    if _collection is None:
        client = _get_client()
        if OPENAI_KEY and OPENAI_KEY != "your-openai-api-key-here":
            from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
            ef = OpenAIEmbeddingFunction(
                api_key=OPENAI_KEY,
                model_name="text-embedding-3-small"
            )
            _collection = client.get_or_create_collection(
                name="guidelines",
                embedding_function=ef
            )
        else:
            _collection = client.get_or_create_collection(name="guidelines")
    return _collection


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


def search_similar(query: str, k: int = 5) -> List[dict]:
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
            matches.append({
                "section": meta.get("section_code", ""),
                "title": meta.get("title", ""),
                "content": doc,
                "score": 1 - dist  # Convert distance to similarity
            })

    return matches
