"""Cinematic forensic HUD overlay renderer for processed CCTV video."""
from __future__ import annotations

from pathlib import Path
from app.models.schemas import ForensicEvent, VideoDetection
from app.utils.frame_utils import timestamp_from_frame


class OverlayRenderer:
    def render(
        self,
        source_path: str,
        output_path: str,
        detections_by_frame: dict[int, list[VideoDetection]],
        events: list[ForensicEvent],
        sample_stride: int,
    ) -> None:
        import cv2

        cap = cv2.VideoCapture(source_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        event_lookup = {event.timestamp[:8]: event for event in events}
        trails: dict[str, list[tuple[int, int]]] = {}
        last_detections: list[VideoDetection] = []

        frame_index = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_index in detections_by_frame:
                last_detections = detections_by_frame[frame_index]
            detections = last_detections if frame_index % sample_stride else detections_by_frame.get(frame_index, [])
            timestamp = timestamp_from_frame(frame_index, fps)
            event = event_lookup.get(timestamp[:8])
            self._draw_hud(cv2, frame, timestamp, event)
            for detection in detections:
                self._draw_detection(cv2, frame, detection, trails)
            writer.write(frame)
            frame_index += 1

        cap.release()
        writer.release()

    def _draw_hud(self, cv2, frame, timestamp: str, event: ForensicEvent | None) -> None:
        h, w = frame.shape[:2]
        crimson = (38, 26, 255)
        teal = (214, 240, 20)
        cv2.rectangle(frame, (0, 0), (w, 58), (3, 5, 12), -1)
        cv2.putText(frame, "AIVENTRA VISUAL INTELLIGENCE", (24, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.72, teal, 2)
        cv2.putText(frame, timestamp, (w - 220, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.68, crimson, 2)
        cv2.line(frame, (0, 58), (w, 58), crimson, 1)
        for x in range(0, w, 64):
            cv2.line(frame, (x, 58), (x + 18, 72), (35, 35, 55), 1)
        if event:
            cv2.rectangle(frame, (18, h - 90), (min(w - 18, 760), h - 24), (20, 8, 18), -1)
            cv2.rectangle(frame, (18, h - 90), (min(w - 18, 760), h - 24), crimson, 2)
            cv2.putText(frame, f"ALERT: {event.event}", (34, h - 54), cv2.FONT_HERSHEY_SIMPLEX, 0.68, crimson, 2)
            cv2.putText(frame, f"CONF {int(event.confidence * 100)}% | {event.severity}", (34, h - 30), cv2.FONT_HERSHEY_SIMPLEX, 0.48, teal, 1)

    def _draw_detection(self, cv2, frame, detection: VideoDetection, trails: dict[str, list[tuple[int, int]]]) -> None:
        box = detection.bbox
        crimson = (38, 26, 255)
        teal = (214, 240, 20)
        color = crimson if detection.label == "person" else teal
        cv2.rectangle(frame, (box.x1, box.y1), (box.x2, box.y2), color, 2)
        tag = f"{detection.track_id or detection.label.upper()} {detection.label} {int(detection.confidence * 100)}%"
        cv2.rectangle(frame, (box.x1, max(0, box.y1 - 24)), (box.x1 + min(260, 9 * len(tag)), box.y1), color, -1)
        cv2.putText(frame, tag, (box.x1 + 5, box.y1 - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.43, (2, 5, 8), 1)
        if detection.track_id and detection.centroid:
            trails.setdefault(detection.track_id, []).append(detection.centroid)
            trails[detection.track_id] = trails[detection.track_id][-32:]
            for p1, p2 in zip(trails[detection.track_id], trails[detection.track_id][1:]):
                cv2.line(frame, p1, p2, teal, 2)
