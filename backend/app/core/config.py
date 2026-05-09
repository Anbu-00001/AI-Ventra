"""
Central configuration management — reads from .env via Pydantic Settings.
All tunable knobs live here so nothing is buried in service code.
"""
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings


BASE_DIR = Path(__file__).resolve().parent.parent  # app/


class Settings(BaseSettings):
    # ── App identity ──────────────────────────────────────────────────────
    APP_NAME: str = "AIVENTRA Forensic Intelligence System"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool | str = True

    # ── CORS ──────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ]

    # ── Ollama AI Inference ──────────────────────────────────────────────
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    PRIMARY_MODEL: str = "llama3:8b"
    BACKUP_MODEL: str = "mistral:7b"
    LLM_TIMEOUT: int = 120
    LLM_MAX_RETRIES: int = 3

    # ── Embeddings ────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # ── FAISS ─────────────────────────────────────────────────────────────
    FAISS_INDEX_PATH: str = str(BASE_DIR / "data" / "vectors" / "faiss.index")
    FAISS_META_PATH: str = str(BASE_DIR / "data" / "vectors" / "meta.json")

    # ── Storage paths ─────────────────────────────────────────────────────
    UPLOADS_DIR: str = str(BASE_DIR / "data" / "uploads")
    EXTRACTED_DIR: str = str(BASE_DIR / "data" / "extracted")
    FINDINGS_DIR: str = str(BASE_DIR / "data" / "findings")
    TIMELINES_DIR: str = str(BASE_DIR / "data" / "timelines")
    REPORTS_DIR: str = str(BASE_DIR / "data" / "reports")
    CORRELATIONS_DIR: str = str(BASE_DIR / "data" / "correlations")
    SYNTHETIC_DIR: str = str(BASE_DIR / "data" / "synthetic")

    # ── Chunking ──────────────────────────────────────────────────────────
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64

    # ── RAG ───────────────────────────────────────────────────────────────
    RAG_TOP_K: int = 5

    # ── File upload limits ────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 50

    class Config:
        env_file = str(BASE_DIR.parent / ".env")
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
