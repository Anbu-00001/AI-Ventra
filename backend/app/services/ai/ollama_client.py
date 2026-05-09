import httpx
import json
import asyncio
from typing import Dict, Any, Tuple
from app.core.config import settings
from app.core.logging import logger

class OllamaClient:
    """
    Ollama API Client for local offline inference.
    Handles chat completions, structured JSON generation, and embeddings.
    """

    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.primary_model = settings.PRIMARY_MODEL
        self.backup_model = settings.BACKUP_MODEL
        self.embedding_model = settings.EMBEDDING_MODEL
        self.timeout = settings.LLM_TIMEOUT
        self.max_retries = settings.LLM_MAX_RETRIES

    async def _post(self, endpoint: str, payload: dict) -> dict:
        url = f"{self.base_url}{endpoint}"
        # Short connect timeout (1s) so we fail fast when Ollama is offline;
        # longer read timeout for actual inference when it IS running.
        timeout = httpx.Timeout(connect=1.0, read=float(self.timeout), write=10.0, pool=5.0)

        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(url, json=payload)
                    response.raise_for_status()
                    return response.json()
            except httpx.ReadTimeout:
                logger.warning(f"Ollama timeout on attempt {attempt + 1}/{self.max_retries}")
                if attempt == self.max_retries - 1:
                    logger.error(f"Ollama {endpoint} completely failed after {self.max_retries} attempts due to timeout.")
                    raise
            except httpx.HTTPStatusError as e:
                logger.error(f"Ollama {endpoint} HTTP error {e.response.status_code}: {e.response.text}")
                if attempt == self.max_retries - 1:
                    raise
            except Exception as e:
                logger.error(f"Ollama request error: {str(e)}")
                if attempt == self.max_retries - 1:
                    raise
            await asyncio.sleep(1)
        return {}

    async def ask_llm(
        self, prompt: str, system: str = "You are AIVENTRA, an expert forensic AI.", model: str = None, temperature: float = 0.2
    ) -> Dict[str, Any]:
        """
        Drop-in replacement for the previous Featherless `ask_llm`.
        Enforces JSON output format.
        """
        model_to_use = model or self.primary_model
        
        payload = {
            "model": model_to_use,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ],
            "format": "json",
            "stream": False,
            "options": {
                "temperature": temperature
            }
        }
        
        try:
            logger.info(f"Ollama query [{model_to_use}]")
            response = await self._post("/api/chat", payload)
            
            content = response.get("message", {}).get("content", "{}")
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                logger.error("Ollama failed to return valid JSON.")
                return {"_error": "Invalid JSON response", "raw_content": content}
                
        except Exception as e:
            logger.error(f"Ollama `ask_llm` failed: {e}")
            if model_to_use == self.primary_model:
                logger.info(f"Falling back to backup model: {self.backup_model}")
                return await self.ask_llm(prompt, system, model=self.backup_model, temperature=temperature)
            return {}

    async def generate_completion(self, prompt: str, model: str = None) -> str:
        """Raw text generation (not enforced JSON)."""
        model_to_use = model or self.primary_model
        payload = {
            "model": model_to_use,
            "prompt": prompt,
            "stream": False
        }
        response = await self._post("/api/generate", payload)
        return response.get("response", "")

    async def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using the local Ollama embedding model."""
        embeddings = []
        for text in texts:
            payload = {
                "model": self.embedding_model,
                "prompt": text
            }
            try:
                response = await self._post("/api/embeddings", payload)
                embeddings.append(response.get("embedding", []))
            except Exception as e:
                logger.error(f"Ollama embedding failed for text snippet: {e}")
                # Return empty embedding to maintain shape
                embeddings.append([0.0] * settings.EMBEDDING_DIMENSION)
        return embeddings

    async def health_check(self) -> Tuple[bool, str]:
        """Check if Ollama is running and models are available."""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(connect=1.0, read=4.0, write=4.0, pool=2.0)) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                res.raise_for_status()
                tags = res.json().get("models", [])
                models = [m["name"] for m in tags]
                
                if self.primary_model not in models:
                    return False, f"Primary model {self.primary_model} not pulled."
                if self.embedding_model not in models:
                    return False, f"Embedding model {self.embedding_model} not pulled."
                    
                return True, "Ollama running perfectly."
        except Exception as e:
            return False, f"Ollama unreachable at {self.base_url}: {str(e)}"

ollama_client = OllamaClient()
