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
        peak_motion = max(motion_values) if motion_values else 0.0

        for idx, sample in enumerate(samples):
            previous = samples[idx - 1] if idx > 0 else None
            next_window = samples[idx + 1: idx + 8]
            spike = sample.motion_score - (previous.motion_score if previous else baseline)

            # 1. Crowd escalation
            if sample.people_count >= 4 and sample.motion_score > max(18, baseline * 1.6):
                desc = (
                    f"{sample.people_count} subjects detected with motion score {sample.motion_score:.1f} "
                    f"({sample.motion_score / max(baseline, 1):.1f}× baseline). "
                    f"Optical flow magnitude: {sample.flow_magnitude:.1f}. Crowd density threshold exceeded."
                )
                anomalies.append(self._anomaly(sample, "crowd_escalation", "HIGH", 0.82, desc))

            # 2. Rapid movement spike
            if spike > 18 or sample.flow_magnitude > 26:
                trigger = "optical flow surge" if sample.flow_magnitude > 26 else "frame-differencing spike"
                desc = (
                    f"Sudden {trigger}: motion jumped {spike:.1f} points to {sample.motion_score:.1f} "
                    f"(flow mag: {sample.flow_magnitude:.1f}). "
                    f"{'Person detected during spike. ' if sample.people_count > 0 else ''}"
                    f"Peak: {peak_motion:.1f}. Baseline: {baseline:.1f}."
                )
                anomalies.append(self._anomaly(sample, "rapid_movement_spike", "ELEVATED", 0.78, desc))

            # 3. Post-event inactivity (collapse / restraint)
            if previous and previous.motion_score > 24 and sample.motion_score < 4 and sample.people_count > 0:
                still_after = next_window and mean([s.motion_score for s in next_window]) < 6
                if still_after:
                    desc = (
                        f"Motion collapsed from {previous.motion_score:.1f} to {sample.motion_score:.1f} "
                        f"with {sample.people_count} subject(s) still in frame. "
                        f"Next {len(next_window)} samples averaged {mean([s.motion_score for s in next_window]):.1f}. "
                        f"Consistent with restraint, collapse, or post-incident inactivity."
                    )
                    anomalies.append(self._anomaly(sample, "post_event_inactivity", "CRITICAL", 0.87, desc))

            # 4. Loitering — single subject with low movement over time
            if sample.people_count == 1 and sample.motion_score < 3 and idx > 6:
                prior_people = max(s.people_count for s in samples[max(0, idx - 8): idx])
                if prior_people <= 1:
                    dwell_samples = sum(1 for s in samples[max(0, idx - 8): idx + 1] if s.people_count >= 1)
                    desc = (
                        f"Single subject present across {dwell_samples} consecutive samples with motion score {sample.motion_score:.1f}. "
                        f"Minimal displacement suggests dwell/loitering at this zone. "
                        f"Flow magnitude {sample.flow_magnitude:.1f} confirms near-stationary behavior."
                    )
                    anomalies.append(self._anomaly(sample, "restricted_zone_loitering", "GUARDED", 0.66, desc))

            # 5. Vehicle departure / count change
            if (sample.vehicle_count > 0 and previous and
                    previous.vehicle_count > sample.vehicle_count and sample.motion_score > 10):
                delta = previous.vehicle_count - sample.vehicle_count
                desc = (
                    f"Vehicle count dropped {previous.vehicle_count}→{sample.vehicle_count} (−{delta}) "
                    f"during active motion (score: {sample.motion_score:.1f}). "
                    f"Flow magnitude: {sample.flow_magnitude:.1f}. "
                    f"Departure sequence at this timestamp warrants review."
                )
                anomalies.append(self._anomaly(sample, "vehicle_departure_anomaly", "ELEVATED", 0.72, desc))

            # 6. Sudden vehicle appearance
            if (sample.vehicle_count > 0 and previous and
                    previous.vehicle_count == 0 and sample.vehicle_count >= 1 and sample.motion_score > 8):
                desc = (
                    f"Vehicle appeared in frame (0→{sample.vehicle_count}) with motion score {sample.motion_score:.1f}. "
                    f"{'Person also detected — possible vehicle-person interaction. ' if sample.people_count > 0 else ''}"
                    f"Optical flow {sample.flow_magnitude:.1f} confirms entry motion."
                )
                anomalies.append(self._anomaly(sample, "vehicle_entry_anomaly", "ELEVATED", 0.75, desc))

            # 7. High-speed motion burst (chase / fight)
            if sample.flow_magnitude > 40 and sample.people_count > 0:
                desc = (
                    f"Extreme optical flow {sample.flow_magnitude:.1f} with {sample.people_count} subject(s) — "
                    f"consistent with running, altercation, or rapid evasion. "
                    f"Motion score: {sample.motion_score:.1f} vs baseline {baseline:.1f}."
                )
                anomalies.append(self._anomaly(sample, "high_velocity_motion", "HIGH", 0.81, desc))

        return self._dedupe(anomalies)

    def _anomaly(self, sample: MotionSample, kind: str, severity: str,
                 confidence: float, description: str) -> MovementAnomaly:
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
        """Deduplicate: keep at most 1 of each type per 5-second window."""
        seen: set[tuple[str, int]] = set()
        output: list[MovementAnomaly] = []
        for anomaly in anomalies:
            # Parse "00:MM:SS.mmm" → total seconds → 5s bucket
            try:
                parts = anomaly.timestamp.replace(",", ".").split(":")
                total_sec = int(parts[-3]) * 3600 + int(parts[-2]) * 60 + float(parts[-1])
                bucket = int(total_sec // 5)
            except Exception:
                bucket = len(output)
            key = (anomaly.type, bucket)
            if key in seen:
                continue
            seen.add(key)
            output.append(anomaly)
        return output[:20]
