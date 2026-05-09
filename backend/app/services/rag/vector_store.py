"""
FAISS vector store.
Supports add, save, load, and semantic search.
"""
import os
import json
import numpy as np
from pathlib import Path

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False

from app.core.config import settings
from app.core.logging import logger


class VectorStore:
    def __init__(self):
        self.index = None
        self.metadata: list[dict] = []
        self.dimension = settings.EMBEDDING_DIMENSION
        self._init_index()

    def _init_index(self):
        if not FAISS_AVAILABLE:
            logger.warning("FAISS not installed — vector search degraded")
            return
        self.index = faiss.IndexFlatIP(self.dimension)  # inner-product for normalised vectors

    def add(self, embeddings: np.ndarray, meta_list: list[dict]) -> None:
        if not FAISS_AVAILABLE or self.index is None:
            return
        if embeddings.shape[0] == 0:
            return
        self.index.add(embeddings.astype(np.float32))
        self.metadata.extend(meta_list)
        logger.info(f"VectorStore: {self.index.ntotal} total vectors")

    def search(self, query_embedding: np.ndarray, k: int = 5) -> list[dict]:
        if not FAISS_AVAILABLE or self.index is None or self.index.ntotal == 0:
            return []
        k = min(k, self.index.ntotal)
        scores, indices = self.index.search(
            query_embedding.reshape(1, -1).astype(np.float32), k
        )
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(self.metadata):
                result = dict(self.metadata[idx])
                result["similarity_score"] = float(score)
                results.append(result)
        return results

    def save(self) -> None:
        if not FAISS_AVAILABLE or self.index is None:
            return
        Path(settings.FAISS_INDEX_PATH).parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, settings.FAISS_INDEX_PATH)
        with open(settings.FAISS_META_PATH, "w") as f:
            json.dump(self.metadata, f)
        logger.info(f"VectorStore saved: {self.index.ntotal} vectors")

    def load(self) -> bool:
        if not FAISS_AVAILABLE:
            return False
        try:
            self.index = faiss.read_index(settings.FAISS_INDEX_PATH)
            with open(settings.FAISS_META_PATH) as f:
                self.metadata = json.load(f)
            # Sync dimension from actual loaded index so queries match
            self.dimension = self.index.d
            logger.info(f"VectorStore loaded: {self.index.ntotal} vectors (dim={self.dimension})")
            return True
        except Exception as e:
            logger.warning(f"Could not load FAISS index: {e} — starting fresh")
            self._init_index()
            return False

    @property
    def total_vectors(self) -> int:
        if self.index is None:
            return 0
        return self.index.ntotal


# Module-level singleton
vector_store = VectorStore()
