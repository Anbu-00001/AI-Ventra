"""AI/RAG explainability for visual intelligence reports."""
from __future__ import annotations

from app.models.schemas import ForensicEvent, MovementAnomaly, ReasoningOutput
from app.services.ai.ollama_client import ollama_client
from app.services.rag.retriever import retrieve


class ForensicReasoningEngine:
    async def explain(
        self,
        threat_level: str,
        threat_score: int,
        events: list[ForensicEvent],
        anomalies: list[MovementAnomaly],
    ) -> ReasoningOutput:
        signals = [event.event for event in events[:8]] or ["No major forensic anomaly exceeded confidence thresholds."]
        query = "CCTV suspicious movement rapid escalation collapse loitering vehicle departure forensic anomaly"
        rag_context = await retrieve(query, k=4)

        prompt = {
            "task": "Generate concise JSON forensic CCTV explainability. Do not classify murder.",
            "threat_level": threat_level,
            "threat_score": threat_score,
            "events": [e.model_dump() for e in events[:8]],
            "anomalies": [a.model_dump() for a in anomalies[:8]],
            "required_schema": {
                "reasoning": ["short evidence-backed reason"],
                "narration": ["cinematic analyst message for dashboard"],
            },
        }
        try:
            llm = await ollama_client.ask_llm(
                str(prompt),
                system="You are AIVENTRA, a forensic CCTV intelligence analyst. Use anomaly terminology only.",
                temperature=0.15,
            )
            reasoning = llm.get("reasoning") if isinstance(llm, dict) else None
            narration = llm.get("narration") if isinstance(llm, dict) else None
            if reasoning and narration:
                return ReasoningOutput(
                    threat_level=threat_level,
                    reasoning=[str(item) for item in reasoning[:6]],
                    narration=[str(item) for item in narration[:5]],
                    rag_context=rag_context,
                    ollama_used=True,
                )
        except Exception:
            pass

        fallback_reasoning = [
            f"Threat score resolved to {threat_score}/100 from temporal motion, object detections, and anomaly rules.",
            *signals[:5],
        ]
        fallback_narration = [
            "Visual intelligence pass complete. Object signatures and motion fields have been fused into a forensic timeline.",
            "Review highlighted segments before forming investigative conclusions.",
        ]
        return ReasoningOutput(
            threat_level=threat_level,
            reasoning=fallback_reasoning,
            narration=fallback_narration,
            rag_context=rag_context,
            ollama_used=False,
        )
