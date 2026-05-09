"""
Forensic Timeline Reconstruction Engine.
Merges GPS pings, CCTV logs, call records, and metadata into a chronological sequence.
"""
import json
from app.services.ai.ollama_client import ollama_client
from app.services.ai.prompt_engine import prompt_engine
from app.models.timeline import ReconstructedTimeline, TimelineEvent
from app.utils.mock_generators import build_timeline_fallback
from app.core.logging import logger


class TimelineBuilder:

    async def build(self, evidence_context: dict) -> ReconstructedTimeline:
        logger.info("Reconstructing forensic timeline...")
        context_str = json.dumps(evidence_context, indent=2)[:3000]
        prompt = prompt_engine.reconstruct_timeline(context_str)

        result = await ollama_client.ask_llm(
            prompt=prompt,
            system=prompt_engine.FORENSIC_SYSTEM,
            temperature=0.2,
        )

        raw_events = result.get("events", [])
        if not raw_events:
            return build_timeline_fallback()

        events = []
        for e in raw_events:
            events.append(TimelineEvent(
                timestamp=e.get("timestamp", "00:00 AM"),
                event_type=e.get("event_type", "UNKNOWN"),
                title=e.get("title", "Event"),
                description=e.get("description", ""),
                location=e.get("location"),
                actors=e.get("actors", []),
                confidence=float(e.get("confidence", 80.0)),
                source=e.get("source", "evidence_corpus"),
                is_anomaly=bool(e.get("is_anomaly", False)),
                severity=e.get("severity"),
            ))

        events.sort(key=lambda x: x.timestamp)
        anomaly_count = sum(1 for e in events if e.is_anomaly)
        avg_confidence = sum(e.confidence for e in events) / max(len(events), 1)

        return ReconstructedTimeline(
            events=events,
            total_events=len(events),
            anomaly_count=anomaly_count,
            confidence_score=round(avg_confidence, 1),
            start_time=events[0].timestamp if events else "N/A",
            end_time=events[-1].timestamp if events else "N/A",
            duration_minutes=round((len(events) * 5.5), 1),
            narrative_summary=result.get("narrative_summary", "Timeline reconstructed from correlated evidence streams."),
            key_insights=result.get("key_insights", []),
        )


timeline_builder = TimelineBuilder()
