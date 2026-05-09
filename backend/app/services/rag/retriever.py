"""
Semantic retriever — embeds a query and fetches top-k relevant evidence chunks.
"""
from app.services.rag.embeddings import embed_single
from app.services.rag.vector_store import vector_store
from app.core.config import settings
from app.core.logging import logger


async def retrieve(query: str, k: int = None) -> list[dict]:
    k = k or settings.RAG_TOP_K
    logger.info(f"Retrieving top-{k} chunks for: '{query[:60]}'")
    query_vec = await embed_single(query)
    results = vector_store.search(query_vec, k=k)
    logger.info(f"Retrieved {len(results)} chunks")
    return results


async def retrieve_texts(query: str, k: int = None) -> list[str]:
    chunks = await retrieve(query, k=k)
    return [c.get("text", "") for c in chunks]
