"""OpenCV temporal motion analysis for suspicious CCTV behavior."""
from __future__ import annotations

import math
from collections import defaultdict, deque
from app.models.schemas import MotionSample, VideoDetection
from app.utils.frame_utils import timestamp_from_frame


class MotionAnalyzer:
    def __init__(self) -> None:
        self.previous_gray = None
        self.track_history: dict[str, deque[tuple[int, int]]] = defaultdict(lambda: deque(maxlen=42))
        self.last_centroids: dict[str, tuple[int, int]] = {}
        self.next_track = 1

    def _assign_tracks(self, detections: list[VideoDetection]) -> None:
        people = [d for d in detections if d.label == "person" and d.centroid]
        assigned: set[str] = set()
        for detection in people:
            cx, cy = detection.centroid or (0, 0)
            best_id = None
            best_dist = 10_000.0
            for track_id, (px, py) in self.last_centroids.items():
                if track_id in assigned:
                    continue
                dist = math.hypot(cx - px, cy - py)
                if dist < best_dist and dist < 90:
                    best_dist = dist
                    best_id = track_id
            if best_id is None:
                best_id = f"S{self.next_track:02d}"
                self.next_track += 1
            detection.track_id = best_id
            assigned.add(best_id)
            self.last_centroids[best_id] = (cx, cy)
            self.track_history[best_id].append((cx, cy))

    def analyze(self, frame, frame_index: int, fps: float, detections: list[VideoDetection]) -> MotionSample:
        import cv2
        import numpy as np

        self._assign_tracks(detections)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        motion_score = 0.0
        active_area_ratio = 0.0
        flow_magnitude = 0.0

        if self.previous_gray is not None:
            diff = cv2.absdiff(self.previous_gray, gray)
            _, thresh = cv2.threshold(diff, 24, 255, cv2.THRESH_BINARY)
            active_area_ratio = float(np.count_nonzero(thresh)) / float(thresh.size)
            motion_score = min(100.0, active_area_ratio * 850.0)

            flow = cv2.calcOpticalFlowFarneback(
                self.previous_gray, gray, None, 0.5, 3, 15, 3, 5, 1.2, 0
            )
            mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
            flow_magnitude = min(100.0, float(np.mean(mag)) * 24.0)

        self.previous_gray = gray
        vehicle_count = sum(1 for d in detections if d.label in {"car", "motorcycle", "truck"})
        people_count = sum(1 for d in detections if d.label == "person")

        return MotionSample(
            frame_index=frame_index,
            timestamp=timestamp_from_frame(frame_index, fps),
            motion_score=round(motion_score, 3),
            active_area_ratio=round(active_area_ratio, 5),
            flow_magnitude=round(flow_magnitude, 3),
            people_count=people_count,
            vehicle_count=vehicle_count,
            subject_tracks={k: list(v) for k, v in self.track_history.items()},
        )
