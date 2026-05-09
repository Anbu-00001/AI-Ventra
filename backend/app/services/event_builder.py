"""Convert low-level CV signals into judge-friendly forensic timelines."""
from __future__ import annotations

from collections import defaultdict
from app.models.schemas import EntitySummary, ForensicEvent, MovementAnomaly, VideoDetection


EVENT_COPY = {
    "rapid_movement_spike": "Rapid behavioral escalation detected",
    "crowd_escalation": "Crowd escalation pattern detected",
    "post_event_inactivity": "Potential collapse or restraint sequence detected",
    "vehicle_departure_anomaly": "Vehicle departure anomaly",
    "restricted_zone_loitering": "Restricted-zone loitering indicator",
}


class EventBuilder:
    def build_events(self, anomalies: list[MovementAnomaly]) -> list[ForensicEvent]:
        events: list[ForensicEvent] = []
        for idx, anomaly in enumerate(anomalies, start=1):
            events.append(
                ForensicEvent(
                    id=f"EVT-{idx:03d}",
                    timestamp=anomaly.timestamp,
                    event=EVENT_COPY.get(anomaly.type, "Abnormal movement pattern detected"),
                    confidence=anomaly.confidence,
                    severity=anomaly.severity,
                    category=anomaly.type,
                    evidence=[anomaly.description],
                )
            )
        return events

    def summarize_entities(self, detections: list[VideoDetection]) -> list[EntitySummary]:
        grouped: dict[str, list[VideoDetection]] = defaultdict(list)
        for detection in detections:
            grouped[detection.label].append(detection)
        summaries: list[EntitySummary] = []
        for label, rows in grouped.items():
            summaries.append(
                EntitySummary(
                    label=label,
                    count=len(rows),
                    max_confidence=max(r.confidence for r in rows),
                    first_seen=rows[0].timestamp,
                    last_seen=rows[-1].timestamp,
                )
            )
        return sorted(summaries, key=lambda item: item.count, reverse=True)

    def threat_score(self, anomalies: list[MovementAnomaly], detections: list[VideoDetection]) -> tuple[int, str]:
        severity_weight = {"GUARDED": 12, "ELEVATED": 18, "HIGH": 25, "CRITICAL": 34}
        score = min(100, sum(severity_weight.get(a.severity, 10) for a in anomalies))
        if any(d.label == "person" for d in detections):
            score = max(score, 28)
        if any(a.type == "post_event_inactivity" for a in anomalies):
            score = max(score, 82)
        level = "LOW"
        if score >= 80:
            level = "CRITICAL"
        elif score >= 60:
            level = "HIGH"
        elif score >= 35:
            level = "ELEVATED"
        return score, level
