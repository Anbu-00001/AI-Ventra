"""YOLOv8 object detection wrapper for CCTV forensic analysis."""
from __future__ import annotations

from dataclasses import dataclass
from app.models.schemas import BoundingBox, VideoDetection
from app.utils.frame_utils import timestamp_from_frame


FORENSIC_CLASSES = {"person", "car", "motorcycle", "truck", "handbag", "cell phone"}


@dataclass
class YoloStatus:
    available: bool
    detail: str


class YoloDetector:
    def __init__(self, model_name: str = "yolov8n.pt", confidence: float = 0.28) -> None:
        self.model_name = model_name
        self.confidence = confidence
        self.model = None
        self.names: dict[int, str] = {}
        self.status = YoloStatus(False, "YOLO not initialized")

    def load(self) -> YoloStatus:
        if self.model is not None:
            return self.status
        try:
            from ultralytics import YOLO

            self.model = YOLO(self.model_name)
            self.names = self.model.names
            self.status = YoloStatus(True, f"Loaded {self.model_name}")
        except Exception as exc:
            self.status = YoloStatus(False, f"YOLO unavailable: {exc}")
        return self.status

    def detect(self, frame, frame_index: int, fps: float) -> list[VideoDetection]:
        status = self.load()
        if not status.available or self.model is None:
            return []

        results = self.model.predict(frame, conf=self.confidence, verbose=False)
        detections: list[VideoDetection] = []
        timestamp = timestamp_from_frame(frame_index, fps)
        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                label = self.names.get(cls_id, str(cls_id))
                if label not in FORENSIC_CLASSES:
                    continue
                conf = float(box.conf[0])
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                centroid = ((x1 + x2) // 2, (y1 + y2) // 2)
                detections.append(
                    VideoDetection(
                        frame_index=frame_index,
                        timestamp=timestamp,
                        label="cellphone" if label == "cell phone" else label,
                        confidence=round(conf, 3),
                        bbox=BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2),
                        centroid=centroid,
                    )
                )
        return detections


yolo_detector = YoloDetector()
