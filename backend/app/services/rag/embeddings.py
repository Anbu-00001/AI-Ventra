"""
Embedding service with sentence-transformers as primary and Ollama as optional.
"""
import numpy as np
from app.core.config import settings
from app.core.logging import logger

_st_model = None


def _get_st_model():
    global _st_model
    if _st_model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading sentence-transformers model all-MiniLM-L6-v2 ...")
        _st_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model ready")
    return _st_model


async def embed_texts(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, settings.EMBEDDING_DIMENSION), dtype=np.float32)

    # Try Ollama first if it might be running
    try:
        from app.services.ai.ollama_client import ollama_client
        raw = await ollama_client.generate_embeddings(texts)
        arr = np.array(raw, dtype=np.float32)
        if arr.shape == (len(texts), settings.EMBEDDING_DIMENSION) and not np.all(arr == 0):
            return arr
    except Exception:
        pass

    # sentence-transformers fallback (always available)
    model = _get_st_model()
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return np.array(embeddings, dtype=np.float32)


async def embed_single(text: str) -> np.ndarray:
    return (await embed_texts([text]))[0]
