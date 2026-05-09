"""Convert low-level CV signals into judge-friendly forensic timelines."""
from __future__ import annotations

from collections import defaultdict
from app.models.schemas import EntitySummary, ForensicEvent, MovementAnomaly, VideoDetection


EVENT_NAMES = {
    "rapid_movement_spike":   "Rapid behavioral escalation detected",
    "crowd_escalation":       "Crowd escalation — high density motion",
    "post_event_inactivity":  "Post-event inactivity — restraint/collapse pattern",
    "vehicle_departure_anomaly": "Vehicle departure anomaly",
    "vehicle_entry_anomaly":  "Vehicle entry — sudden appearance",
    "restricted_zone_loitering": "Restricted-zone loitering indicator",
    "high_velocity_motion":   "High-velocity motion burst — altercation/evasion",
}

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "ELEVATED": 2, "GUARDED": 3}


class EventBuilder:
    def build_events(self, anomalies: list[MovementAnomaly]) -> list[ForensicEvent]:
        events: list[ForensicEvent] = []
        # Sort most-severe first within the same timestamp bucket
        sorted_anomalies = sorted(
            anomalies,
            key=lambda a: (a.timestamp[:8], SEVERITY_ORDER.get(a.severity, 9))
        )
        for idx, anomaly in enumerate(sorted_anomalies, start=1):
            name = EVENT_NAMES.get(anomaly.type, "Abnormal movement pattern detected")
            # Build rich evidence string using actual metrics
            m = anomaly.metrics
            evidence_detail = (
                f"Motion: {m.get('motion_score', 0):.1f} · "
                f"Flow: {m.get('flow_magnitude', 0):.1f} · "
                f"People: {int(m.get('people_count', 0))} · "
                f"Vehicles: {int(m.get('vehicle_count', 0))}"
            )
            events.append(ForensicEvent(
                id=f"EVT-{idx:03d}",
                timestamp=anomaly.timestamp,
                event=name,
                confidence=anomaly.confidence,
                severity=anomaly.severity,
                category=anomaly.type,
                evidence=[anomaly.description, evidence_detail],
            ))
        return events

    def summarize_entities(self, detections: list[VideoDetection]) -> list[EntitySummary]:
        grouped: dict[str, list[VideoDetection]] = defaultdict(list)
        for detection in detections:
            grouped[detection.label].append(detection)
        summaries: list[EntitySummary] = []
        for label, rows in grouped.items():
            summaries.append(EntitySummary(
                label=label,
                count=len(rows),
                max_confidence=max(r.confidence for r in rows),
                first_seen=rows[0].timestamp,
                last_seen=rows[-1].timestamp,
            ))
        return sorted(summaries, key=lambda x: x.count, reverse=True)

    def threat_score(self, anomalies: list[MovementAnomaly],
                     detections: list[VideoDetection]) -> tuple[int, str]:
        severity_weight = {"GUARDED": 10, "ELEVATED": 18, "HIGH": 28, "CRITICAL": 40}
        score = min(100, sum(severity_weight.get(a.severity, 10) for a in anomalies))
        # Floor based on detected subjects
        if any(d.label == "person" for d in detections):
            score = max(score, 28)
        if any(a.type == "post_event_inactivity" for a in anomalies):
            score = max(score, 82)
        if any(a.type in ("high_velocity_motion", "crowd_escalation") for a in anomalies):
            score = max(score, 55)
        level = "LOW"
        if score >= 80:
            level = "CRITICAL"
        elif score >= 60:
            level = "HIGH"
        elif score >= 35:
            level = "ELEVATED"
        return score, level
