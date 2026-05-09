"""
FastAPI dependency injections — shared across route handlers.
"""
from app.services.rag.vector_store import vector_store
from app.services.ai.ollama_client import ollama_client


async def get_vector_store():
    return vector_store


async def get_featherless():
    return ollama_client
