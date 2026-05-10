"""Forensic HUD overlay renderer — full-clip, smooth, with ML behavioral class."""
from __future__ import annotations

from pathlib import Path
from app.models.schemas import ForensicEvent, VideoDetection

# Threat tier → BGR color for ML badge
_TIER_COLOR = {
    "HIGH":    (30,  30,  220),   # red
    "MEDIUM":  (20, 140,  255),   # amber
    "LOW":     (30, 160,   30),   # green
    "UNKNOWN": (120, 120, 120),   # grey
}


class OverlayRenderer:
    def render(
        self,
        source_path: str,
        output_path: str,
        detections_by_frame: dict[int, list[VideoDetection]],
        events: list[ForensicEvent],
        _sample_stride: int,
        behavior_by_frame: dict[int, dict] | None = None,
    ) -> None:
        import cv2

        cap    = cv2.VideoCapture(source_path)
        fps    = cap.get(cv2.CAP_PROP_FPS) or 24.0
        width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)  or 1280)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)

        # Scale down wide videos to max 1280px wide (keeps aspect ratio)
        out_w, out_h = width, height
        if width > 1280:
            scale  = 1280.0 / width
            out_w  = 1280
            out_h  = int(height * scale)

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # Try codecs in order — avc1 (H.264) gives best browser compatibility
        writer = None
        for codec in ("avc1", "X264", "H264", "mp4v"):
            fourcc = cv2.VideoWriter_fourcc(*codec)
            w = cv2.VideoWriter(output_path, fourcc, fps, (out_w, out_h))
            if w.isOpened():
                writer = w
                break
        if writer is None:
            cap.release()
            return

        event_lookup: dict[str, ForensicEvent] = {
            e.timestamp[:8]: e for e in events
        }
        trails:           dict[str, list[tuple[int, int]]] = {}
        last_detections:  list[VideoDetection]             = []
        last_behavior:    dict                             = {"class": "", "confidence": 0.0, "threat_tier": "UNKNOWN"}

        frame_index = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            # Update cached detections and ML behavior at each analysis point
            if frame_index in detections_by_frame:
                last_detections = detections_by_frame[frame_index]
            if behavior_by_frame and frame_index in behavior_by_frame:
                last_behavior = behavior_by_frame[frame_index]

            # Interpolate detections between sample points using last known
            detections = last_detections

            from app.utils.frame_utils import timestamp_from_frame
            timestamp = timestamp_from_frame(frame_index, fps)
            event     = event_lookup.get(timestamp[:8])

            # Draw all overlays on every frame → smooth full-clip video
            self._draw_hud(cv2, frame, timestamp, event, last_behavior)
            for det in detections:
                self._draw_detection(cv2, frame, det, trails)

            if width > 1280:
                frame = cv2.resize(frame, (out_w, out_h))

            writer.write(frame)
            frame_index += 1

        cap.release()
        writer.release()

    # ── HUD ──────────────────────────────────────────────────────────────────

    def _draw_hud(
        self,
        cv2,
        frame,
        timestamp: str,
        event: ForensicEvent | None,
        behavior: dict | None = None,
    ) -> None:
        h, w    = frame.shape[:2]
        crimson = (38,  26, 255)
        teal    = (214, 240,  20)

        # Top bar background
        cv2.rectangle(frame, (0, 0), (w, 58), (3, 5, 12), -1)
        cv2.putText(frame, "AIVENTRA VISUAL INTELLIGENCE",
                    (24, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.72, teal, 2)
        cv2.putText(frame, timestamp,
                    (w - 220, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.68, crimson, 2)
        cv2.line(frame, (0, 58), (w, 58), crimson, 1)
        for x in range(0, w, 64):
            cv2.line(frame, (x, 58), (x + 18, 72), (35, 35, 55), 1)

        # ML behavioral class badge — top right beside timestamp
        if behavior and behavior.get("class"):
            cls   = behavior["class"]
            conf  = int(behavior.get("confidence", 0) * 100)
            tier  = behavior.get("threat_tier", "UNKNOWN")
            color = _TIER_COLOR.get(tier, _TIER_COLOR["UNKNOWN"])
            label = f"ML:{cls.upper()} {conf}%"
            tw    = len(label) * 11 + 10
            x0    = w - tw - 230        # left of timestamp
            cv2.rectangle(frame, (x0, 6), (x0 + tw, 50), color, -1)
            cv2.putText(frame, label,
                        (x0 + 5, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

        # Bottom alert bar
        if event:
            bx2 = min(w - 18, 760)
            cv2.rectangle(frame, (18, h - 90), (bx2, h - 24), (20, 8, 18), -1)
            cv2.rectangle(frame, (18, h - 90), (bx2, h - 24), crimson, 2)
            cv2.putText(frame, f"ALERT: {event.event}",
                        (34, h - 54), cv2.FONT_HERSHEY_SIMPLEX, 0.68, crimson, 2)
            cv2.putText(frame, f"CONF {int(event.confidence*100)}% | {event.severity}",
                        (34, h - 30), cv2.FONT_HERSHEY_SIMPLEX, 0.48, teal, 1)

    # ── Detection boxes + motion trails ──────────────────────────────────────

    def _draw_detection(
        self,
        cv2,
        frame,
        detection: VideoDetection,
        trails: dict[str, list[tuple[int, int]]],
    ) -> None:
        box     = detection.bbox
        crimson = (38,  26, 255)
        teal    = (214, 240,  20)
        color   = crimson if detection.label == "person" else teal

        cv2.rectangle(frame, (box.x1, box.y1), (box.x2, box.y2), color, 2)

        tag   = f"{detection.track_id or detection.label.upper()} {int(detection.confidence*100)}%"
        tag_w = min(9 * len(tag) + 10, frame.shape[1] - box.x1)
        tag_y = max(0, box.y1 - 24)
        cv2.rectangle(frame, (box.x1, tag_y), (box.x1 + tag_w, box.y1), color, -1)
        cv2.putText(frame, tag,
                    (box.x1 + 5, box.y1 - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.43, (2, 5, 8), 1)

        # Motion trail
        if detection.track_id and detection.centroid:
            key = detection.track_id
            trails.setdefault(key, []).append(detection.centroid)
            trails[key] = trails[key][-32:]
            pts = trails[key]
            for p1, p2 in zip(pts, pts[1:]):
                cv2.line(frame, p1, p2, teal, 2)
