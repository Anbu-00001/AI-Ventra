"""
AI Explainability Engine.
Answers: "Why did the AI reach this conclusion?"
"""
from app.services.rag.retriever import retrieve_texts
from app.services.ai.ollama_client import ollama_client
from app.services.ai.prompt_engine import prompt_engine
from app.core.logging import logger


async def explain_conclusion(conclusion: str, top_k: int = 5) -> dict:
    logger.info(f"Generating explainability report for: {conclusion[:60]}")
    chunks = await retrieve_texts(conclusion, k=top_k)

    prompt = prompt_engine.explainability(conclusion, chunks)
    result = await ollama_client.ask_llm(
        prompt=prompt,
        system=prompt_engine.SYNTHESIS_SYSTEM,
        temperature=0.2,
    )
    result["supporting_chunks"] = chunks
    return result
