"""
Health check route — status of all system components.
"""
from fastapi import APIRouter
from app.services.ai.ollama_client import ollama_client
from app.services.rag.vector_store import vector_store

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check():
    llm_ok, model_or_error = await ollama_client.health_check()
    return {
        "status": "operational",
        "llm": "connected" if llm_ok else "offline",
        "rag": "ready",
        "components": {
            "api": "online",
            "featherless": "connected" if llm_ok else "offline - fallback active",
            "rag": "ready" if vector_store.total_vectors > 0 else "ready - index synthetic data or upload evidence",
            "vector_store_size": vector_store.total_vectors,
        },
        "primary_model": ollama_client.primary_model,
        "backup_model": ollama_client.backup_model,
        "active_model": model_or_error if llm_ok else None,
        "provider": "Featherless AI",
        "message": "All systems operational" if llm_ok else f"Featherless unavailable, fallback mode active: {model_or_error}",
    }
