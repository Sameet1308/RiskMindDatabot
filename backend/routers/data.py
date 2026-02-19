"""
Data status router — serves the Data Connector tile metadata.
"""
from fastapi import APIRouter
from database.connection import async_session

router = APIRouter()


@router.get("/status")
async def data_status():
    """Connection status + table metadata for the Data Connector tile."""
    from sqlalchemy import text as sqtext
    counts = {}
    schema_info = []
    try:
        async with async_session() as db:
            for table, label, desc in [
                ("policies", "Policies", "Commercial insurance policies"),
                ("claims", "Claims", "Filed claims history"),
                ("decisions", "Decisions", "Underwriting decisions"),
                ("guidelines", "Guidelines", "Underwriting rule sections"),
                ("documents", "Documents", "Uploaded files & analysis"),
                ("users", "Users", "Underwriter accounts"),
            ]:
                result = await db.execute(sqtext(f"SELECT COUNT(*) FROM {table}"))
                cnt = result.scalar() or 0
                counts[table] = cnt
                schema_info.append({"table": table, "label": label, "description": desc, "rows": cnt})

            # Get column counts per table
            for item in schema_info:
                result = await db.execute(sqtext(f"SELECT * FROM pragma_table_info('{item['table']}')"))
                item["columns"] = len(result.fetchall())

    except Exception as e:
        return {"status": "error", "error": str(e)}

    # ChromaDB status
    chroma_status = {}
    try:
        from services.vector_store import get_collection, get_knowledge_collection, _ef_name
        chroma_status["guidelines_indexed"] = get_collection().count()
        chroma_status["knowledge_indexed"] = get_knowledge_collection().count()
        chroma_status["embedding_provider"] = _ef_name or "default"
    except Exception:
        chroma_status["guidelines_indexed"] = 0
        chroma_status["knowledge_indexed"] = 0
        chroma_status["embedding_provider"] = "unavailable"

    return {
        "status": "connected",
        "database": "SQLite",
        "database_name": "riskmind.db",
        "tables": schema_info,
        "total_records": sum(counts.values()),
        "vector_store": chroma_status,
    }
