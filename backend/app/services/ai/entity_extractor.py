"""
Forensic Entity Extractor — identifies persons, devices, locations,
timestamps, and organizations from raw evidence text.
"""
from app.services.ai.ollama_client import ollama_client
from app.services.ai.prompt_engine import prompt_engine
from app.core.logging import logger


class EntityExtractor:

    async def extract(self, text: str) -> dict:
        logger.info(f"Extracting entities from {len(text)} chars...")
        prompt = prompt_engine.extract_entities(text)
        result = await ollama_client.ask_llm(
            prompt=prompt,
            system=prompt_engine.FORENSIC_SYSTEM,
            temperature=0.1,
        )
        return {
            "persons": result.get("persons", []),
            "locations": result.get("locations", []),
            "devices": result.get("devices", []),
            "timestamps": result.get("timestamps", []),
            "organizations": result.get("organizations", []),
            "physical_evidence": result.get("physical_evidence", []),
        }


entity_extractor = EntityExtractor()
