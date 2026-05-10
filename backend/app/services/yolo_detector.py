"""YOLOv8 detection + MobileNetV2 behavioral classifier for CCTV forensic analysis."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from app.models.schemas import BoundingBox, VideoDetection
from app.utils.frame_utils import timestamp_from_frame

FORENSIC_CLASSES = {"person", "car", "motorcycle", "truck", "handbag", "cell phone"}

# Model paths — resolve relative to project root (two levels above backend/app)
_BACKEND_DIR = Path(__file__).resolve().parents[3]   # AIVentra_org/
_MODEL_PATH  = _BACKEND_DIR / "models" / "anomaly_classifier.pth"
_LABEL_PATH  = _BACKEND_DIR / "models" / "label_encoder.json"

# Threat tier for color-coded overlay
_HIGH_THREAT   = {"Abuse", "Assault", "Shooting", "Robbery", "Fighting"}
_MED_THREAT    = {"Burglary", "Arrest", "Explosion"}
_LOW_THREAT    = {"Normal", "RoadAccident"}


@dataclass
class YoloStatus:
    available: bool
    detail: str


# ── Behavioral Classifier (MobileNetV2 trained on 10-class forensic dataset) ─
class BehavioralClassifier:
    """
    Wraps the trained anomaly_classifier.pth model.
    Loaded lazily on first call to classify().
    Classifies each frame into one of 10 forensic activity classes.
    """

    def __init__(self) -> None:
        self._model   = None
        self._classes: list[str] = []
        self._tf      = None
        self._ready   = False
        self._tried   = False

    def _load(self) -> bool:
        if self._tried:
            return self._ready
        self._tried = True
        try:
            import torch
            import torch.nn as nn
            from torchvision import models, transforms

            if not _MODEL_PATH.exists() or not _LABEL_PATH.exists():
                print(f"[BehavioralClassifier] Model not found at {_MODEL_PATH}")
                return False

            with open(_LABEL_PATH) as f:
                meta = json.load(f)
            self._classes = meta["classes"]

            # Rebuild MobileNetV2 head — must match train_model.py exactly
            net = models.mobilenet_v2(weights=None)
            in_feat = net.classifier[1].in_features
            net.classifier = nn.Sequential(
                nn.Dropout(p=0.4),
                nn.Linear(in_feat, 512),
                nn.ReLU(inplace=True),
                nn.Dropout(p=0.35),
                nn.Linear(512, len(self._classes)),
            )
            net.load_state_dict(
                torch.load(_MODEL_PATH, map_location="cpu", weights_only=True)
            )
            net.eval()
            self._model = net

            self._tf = transforms.Compose([
                transforms.ToPILImage(),
                transforms.Resize((160, 160)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])
            self._ready = True
            print(f"[BehavioralClassifier] Loaded — classes: {self._classes}")
        except Exception as e:
            print(f"[BehavioralClassifier] Load failed: {e}")
        return self._ready

    def classify(self, frame) -> dict:
        """
        Classify a BGR numpy frame.
        Returns {"class": "Fighting", "confidence": 0.92, "threat_tier": "HIGH", "all_scores": {...}}
        """
        if not self._load() or self._model is None:
            return {"class": "Unknown", "confidence": 0.0, "threat_tier": "UNKNOWN", "all_scores": {}}

        try:
            import torch
            import cv2
            rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            tensor = self._tf(rgb).unsqueeze(0)
            with torch.no_grad():
                probs = torch.softmax(self._model(tensor), dim=1).squeeze().numpy()
            top   = int(probs.argmax())
            label = self._classes[top]
            tier  = (
                "HIGH"   if label in _HIGH_THREAT else
                "MEDIUM" if label in _MED_THREAT  else
                "LOW"
            )
            return {
                "class":       label,
                "confidence":  round(float(probs[top]), 3),
                "threat_tier": tier,
                "all_scores":  {self._classes[i]: round(float(p), 3) for i, p in enumerate(probs)},
            }
        except Exception as e:
            return {"class": "Unknown", "confidence": 0.0, "threat_tier": "UNKNOWN", "all_scores": {}}

    @property
    def available(self) -> bool:
        return self._load()

    @property
    def classes(self) -> list[str]:
        self._load()
        return self._classes


# ── YOLO Object Detector ──────────────────────────────────────────────────────
class YoloDetector:
    def __init__(self, model_name: str = "yolov8n.pt", confidence: float = 0.28) -> None:
        self.model_name = model_name
        self.confidence = confidence
        self.model      = None
        self.names: dict[int, str] = {}
        self.status = YoloStatus(False, "YOLO not initialized")

    def load(self) -> YoloStatus:
        if self.model is not None:
            return self.status
        try:
            from ultralytics import YOLO
            self.model  = YOLO(self.model_name)
            self.names  = self.model.names
            self.status = YoloStatus(True, f"Loaded {self.model_name}")
        except Exception as exc:
            self.status = YoloStatus(False, f"YOLO unavailable: {exc}")
        return self.status

    def detect(self, frame, frame_index: int, fps: float) -> list[VideoDetection]:
        if not self.load().available or self.model is None:
            return []

        results   = self.model.predict(frame, conf=self.confidence, imgsz=320, verbose=False)
        timestamp = timestamp_from_frame(frame_index, fps)
        detections: list[VideoDetection] = []

        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                label  = self.names.get(cls_id, str(cls_id))
                if label not in FORENSIC_CLASSES:
                    continue
                conf          = float(box.conf[0])
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                centroid      = ((x1 + x2) // 2, (y1 + y2) // 2)
                detections.append(VideoDetection(
                    frame_index=frame_index,
                    timestamp=timestamp,
                    label="cellphone" if label == "cell phone" else label,
                    confidence=round(conf, 3),
                    bbox=BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2),
                    centroid=centroid,
                ))
        return detections


# ── Singletons ────────────────────────────────────────────────────────────────
yolo_detector      = YoloDetector()
ml_classifier      = BehavioralClassifier()
