"""AI Evidence Classifier — categorises uploaded files using Featherless AI."""
from app.services.ai.ollama_client import ollama_client
from app.services.ai.prompt_engine import prompt_engine
from app.models.evidence import EvidenceClassification
from app.core.logging import logger


class EvidenceClassifier:

    async def classify(self, content_preview: str, filename: str, file_type: str) -> EvidenceClassification:
        logger.info(f"Classifying evidence: {filename}")
        prompt = prompt_engine.classify_evidence(content_preview, filename, file_type)
        result = await ollama_client.ask_llm(
            prompt=prompt,
            system=prompt_engine.FORENSIC_SYSTEM,
            temperature=0.15,
        )

        # Map file extension hints for deterministic boost
        auto_category = self._hint_category(filename, file_type)
        category = result.get("primary_category", auto_category)

        return EvidenceClassification(
            file_id="",  # filled by caller
            category=category,
            sub_category=result.get("sub_category"),
            confidence=float(result.get("confidence", 85.0)),
            tags=result.get("tags", []),
        )

    def _hint_category(self, filename: str, file_type: str) -> str:
        name_lower = filename.lower()
        if "autopsy" in name_lower or "post" in name_lower:
            return "autopsy_report"
        if "gps" in name_lower or "location" in name_lower:
            return "gps_log"
        if "cctv" in name_lower or "camera" in name_lower:
            return "cctv_log"
        if "call" in name_lower or "phone" in name_lower:
            return "call_log"
        if file_type == "pdf":
            return "autopsy_report"
        if file_type == "csv":
            return "environmental_data"
        if file_type == "json":
            return "gps_log"
        if file_type in ("image", "jpg", "png"):
            return "forensic_image"
        return "digital_evidence"


evidence_classifier = EvidenceClassifier()
