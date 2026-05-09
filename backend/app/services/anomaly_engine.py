"""Rule-based forensic anomaly intelligence over detections and motion samples."""
from __future__ import annotations

from statistics import mean
from app.models.schemas import MotionSample, MovementAnomaly


class AnomalyEngine:
    def analyze(self, samples: list[MotionSample]) -> list[MovementAnomaly]:
        if not samples:
            return []

        anomalies: list[MovementAnomaly] = []
        motion_values = [s.motion_score for s in samples]
        baseline = mean(motion_values) if motion_values else 0.0

        for idx, sample in enumerate(samples):
            previous = samples[idx - 1] if idx > 0 else None
            next_window = samples[idx + 1 : idx + 8]
            spike = sample.motion_score - (previous.motion_score if previous else baseline)

            if sample.people_count >= 4 and sample.motion_score > max(18, baseline * 1.6):
                anomalies.append(self._anomaly(sample, "crowd_escalation", "HIGH", 0.82, "Crowd density and motion accelerated in the same time window."))

            if spike > 18 or sample.flow_magnitude > 26:
                anomalies.append(self._anomaly(sample, "rapid_movement_spike", "ELEVATED", 0.78, "Sudden frame-to-frame motion spike detected by optical flow and frame differencing."))

            if previous and previous.motion_score > 24 and sample.motion_score < 4 and sample.people_count > 0:
                still_after = next_window and mean([s.motion_score for s in next_window]) < 6
                if still_after:
                    anomalies.append(self._anomaly(sample, "post_event_inactivity", "CRITICAL", 0.87, "Abrupt movement drop followed by inactivity, consistent with collapse or restraint-like behavior."))

            if sample.people_count == 1 and sample.motion_score < 3 and idx > 6:
                prior_people = max(s.people_count for s in samples[max(0, idx - 8) : idx])
                if prior_people <= 1:
                    anomalies.append(self._anomaly(sample, "restricted_zone_loitering", "GUARDED", 0.66, "Single subject remained in scene with low displacement across multiple samples."))

            if sample.vehicle_count > 0 and previous and previous.vehicle_count > sample.vehicle_count and sample.motion_score > 10:
                anomalies.append(self._anomaly(sample, "vehicle_departure_anomaly", "ELEVATED", 0.72, "Vehicle count changed during active motion; departure sequence should be reviewed."))

        return self._dedupe(anomalies)

    def _anomaly(self, sample: MotionSample, kind: str, severity: str, confidence: float, description: str) -> MovementAnomaly:
        return MovementAnomaly(
            timestamp=sample.timestamp,
            type=kind,
            confidence=confidence,
            severity=severity,
            description=description,
            metrics={
                "motion_score": sample.motion_score,
                "flow_magnitude": sample.flow_magnitude,
                "people_count": sample.people_count,
                "vehicle_count": sample.vehicle_count,
            },
        )

    def _dedupe(self, anomalies: list[MovementAnomaly]) -> list[MovementAnomaly]:
        seen: set[tuple[str, str]] = set()
        output: list[MovementAnomaly] = []
        for anomaly in anomalies:
            second_key = anomaly.timestamp[:8]
            key = (second_key, anomaly.type)
            if key in seen:
                continue
            seen.add(key)
            output.append(anomaly)
        return output[:24]
