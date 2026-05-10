"""End-to-end CCTV intelligence pipeline — full-clip analysis + ML behavioral classification."""
from __future__ import annotations

import os
import uuid
from collections import Counter

from app.core.config import BASE_DIR
from app.models.schemas import VideoAnalysisReport, VideoDetection
from app.services.anomaly_engine import AnomalyEngine
from app.services.event_builder import EventBuilder
from app.services.forensic_reasoning import ForensicReasoningEngine
from app.services.motion_analyzer import MotionAnalyzer
from app.services.overlay_renderer import OverlayRenderer
from app.services.yolo_detector import ml_classifier, yolo_detector
from app.utils.frame_utils import ensure_video_dirs, public_video_url, snapshot_url
from app.utils.json_utils import save_json

VIDEO_UPLOADS_DIR   = str(BASE_DIR.parent / "uploads")
VIDEO_PROCESSED_DIR = str(BASE_DIR.parent / "processed")
VIDEO_REPORTS_DIR   = str(BASE_DIR.parent / "reports")

# YOLO label colors BGR
_LABEL_COLOR = {
    "person":     (38,  26,  255),
    "car":        (20,  240, 214),
    "truck":      (20,  200, 214),
    "motorcycle": (20,  180, 214),
    "cellphone":  (30,  200, 255),
    "handbag":    (50,  150, 255),
}
_DEFAULT_COLOR = (200, 200, 200)


def _draw_yolo_boxes(cv2, frame, detections: list[VideoDetection]) -> None:
    for d in detections:
        b     = d.bbox
        color = _LABEL_COLOR.get(d.label, _DEFAULT_COLOR)
        cv2.rectangle(frame, (b.x1, b.y1), (b.x2, b.y2), color, 2)
        tag   = f"{d.label.upper()} {int(d.confidence * 100)}%"
        if d.track_id:
            tag = f"[{d.track_id}] {tag}"
        tag_w = min(len(tag) * 10 + 8, frame.shape[1] - b.x1)
        tag_y = max(0, b.y1 - 22)
        cv2.rectangle(frame, (b.x1, tag_y), (b.x1 + tag_w, b.y1), color, -1)
        cv2.putText(frame, tag, (b.x1 + 4, b.y1 - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (8, 8, 8), 1)
    # corner scan accents
    h, w = frame.shape[:2]
    teal = (214, 240, 20)
    for (px, py, ex, ey) in [(0,0,28,0),(0,0,0,28),(w-28,0,w,0),(w,0,w,28),(0,h-28,0,h),(0,h,28,h)]:
        cv2.line(frame, (px, py), (ex, ey), teal, 2)


class VideoIntelligencePipeline:
    def __init__(self) -> None:
        self.events    = EventBuilder()
        self.anomalies = AnomalyEngine()
        self.reasoning = ForensicReasoningEngine()
        self.renderer  = OverlayRenderer()

    async def analyze(
        self, source_path: str, case_id: str, progress=None
    ) -> VideoAnalysisReport:
        import cv2

        ensure_video_dirs(VIDEO_UPLOADS_DIR, VIDEO_PROCESSED_DIR, VIDEO_REPORTS_DIR)
        analysis_id = f"vis-{uuid.uuid4().hex[:12]}"

        cap = cv2.VideoCapture(source_path)
        if not cap.isOpened():
            raise ValueError("Unable to open video. Upload a valid MP4/MOV/AVI/MKV clip.")

        fps         = cap.get(cv2.CAP_PROP_FPS) or 24.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        vid_w       = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)  or 1280)
        vid_h       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
        duration    = frame_count / max(fps, 1.0)

        # ── Stride: analyze 6 frames/sec (full-clip coverage, fast enough on CPU)
        sample_stride = max(1, int(fps / 6))
        # ── Snapshots: one every ~3 seconds, up to 20
        snap_every    = max(sample_stride, int(fps * 3))

        motion   = MotionAnalyzer()
        all_detections:     list[VideoDetection]       = []
        detections_by_frame: dict[int, list[VideoDetection]] = {}
        behavior_by_frame:   dict[int, dict]           = {}
        samples  = []
        snapshots: list[str] = []

        if progress:
            await progress({
                "type": "stage", "stage": "video_loaded", "progress": 5,
                "video_width": vid_w, "video_height": vid_h,
                "detail": (
                    f"{duration:.1f}s · {int(fps)}fps · {frame_count} frames · "
                    f"stride={sample_stride} ({fps/sample_stride:.0f} samples/sec) · "
                    f"ML={'on' if ml_classifier.available else 'off'}"
                ),
            })

        # ── Main frame-by-frame analysis loop ────────────────────────────────
        frame_index = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            if frame_index % sample_stride == 0:
                # YOLO detection
                detections = yolo_detector.detect(frame, frame_index, fps)

                # ML behavioral classification — runs on the same frame
                behavior = ml_classifier.classify(frame)

                # Motion analysis
                sample = motion.analyze(frame, frame_index, fps, detections)

                all_detections.extend(detections)
                detections_by_frame[frame_index] = detections
                behavior_by_frame[frame_index]   = behavior
                samples.append(sample)

                # Snapshot with YOLO boxes
                if frame_index % snap_every == 0 and len(snapshots) < 20:
                    filename  = f"{analysis_id}_{frame_index}.jpg"
                    snap_path = os.path.join(VIDEO_PROCESSED_DIR, filename)
                    annotated = frame.copy()
                    _draw_yolo_boxes(cv2, annotated, detections)
                    # Add ML class badge on snapshot
                    if behavior.get("class"):
                        _draw_ml_badge(cv2, annotated, behavior)
                    cv2.imwrite(snap_path, annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])
                    snapshots.append(snapshot_url(analysis_id, filename))

                if progress and frame_count:
                    pct = 5 + int((frame_index / frame_count) * 55)
                    await progress({
                        "type": "detection",
                        "stage": "yolo_ml_scan",
                        "progress": min(60, pct),
                        "frame": frame_index,
                        "timestamp": f"{frame_index/fps:.1f}s",
                        "video_width": vid_w, "video_height": vid_h,
                        "detections": [d.model_dump() for d in detections[:12]],
                        "motion":     sample.model_dump(),
                        "behavior":   behavior,
                    })

            frame_index += 1
        cap.release()

        # ── Anomaly + timeline + threat ──────────────────────────────────────
        if progress:
            await progress({
                "type": "stage", "stage": "anomaly_fusion", "progress": 65,
                "detail": (
                    f"Fusing {len(samples)} samples · "
                    f"YOLO detections={len(all_detections)} · "
                    f"ML dominant={_dominant_class(behavior_by_frame)}"
                ),
            })

        anomaly_rows = self.anomalies.analyze(samples)
        timeline     = self.events.build_events(anomaly_rows)
        entities     = self.events.summarize_entities(all_detections)
        threat_score, threat_level = self.events.threat_score(anomaly_rows, all_detections)

        # Boost threat score if ML detects high-threat class
        ml_dominant, ml_conf = _dominant_class_with_conf(behavior_by_frame)
        threat_score, threat_level = _ml_boosted_threat(
            threat_score, threat_level, ml_dominant, ml_conf
        )

        waveform = [round(min(1.0, s.motion_score / 100.0), 3) for s in samples]
        reasoning = await self.reasoning.explain(
            threat_level, threat_score, timeline, anomaly_rows
        )

        # ── Render annotated video ────────────────────────────────────────────
        if progress:
            await progress({
                "type": "stage", "stage": "overlay_render", "progress": 72,
                "detail": "Rendering full-clip YOLO + ML + HUD overlay",
            })

        processed_path = os.path.join(VIDEO_PROCESSED_DIR, f"{analysis_id}.mp4")
        self.renderer.render(
            source_path, processed_path,
            detections_by_frame, timeline,
            sample_stride, behavior_by_frame,
        )

        # ── Build report ──────────────────────────────────────────────────────
        ml_summary = _build_ml_summary(behavior_by_frame)

        report = VideoAnalysisReport(
            analysis_id=analysis_id,
            case_id=case_id,
            source_video=os.path.basename(source_path),
            processed_video_url=public_video_url(analysis_id),
            duration_seconds=round(duration, 3),
            fps=round(fps, 3),
            frame_count=frame_count,
            processed_frames=len(samples),
            threat_score=threat_score,
            threat_level=threat_level,
            detected_entities=entities,
            event_timeline=timeline,
            movement_anomalies=anomaly_rows,
            reasoning_engine=reasoning,
            confidence_waveform=waveform,
            snapshots=snapshots,
            meta={
                "yolo":            yolo_detector.status.__dict__,
                "ml_classifier":   {
                    "available": ml_classifier.available,
                    "model":     "MobileNetV2 anomaly_classifier.pth",
                    "classes":   ml_classifier.classes,
                },
                "ml_analysis":     ml_summary,
                "sample_stride":   sample_stride,
                "samples_per_sec": round(fps / sample_stride, 1),
                "total_samples":   len(samples),
                "detector":        "YOLOv8n pretrained COCO + MobileNetV2 forensic classifier",
            },
        )

        save_json(
            report.model_dump(),
            os.path.join(VIDEO_REPORTS_DIR, f"{analysis_id}.json"),
        )
        if progress:
            await progress({
                "type": "complete", "stage": "complete", "progress": 100,
                "analysis_id": analysis_id, "report": report.model_dump(),
            })
        return report


# ── Helpers ───────────────────────────────────────────────────────────────────

def _draw_ml_badge(cv2, frame, behavior: dict) -> None:
    """Draw ML class badge in top-right corner of a snapshot."""
    cls  = behavior.get("class", "?")
    conf = int(behavior.get("confidence", 0) * 100)
    tier = behavior.get("threat_tier", "LOW")
    color = (0, 0, 220) if tier == "HIGH" else (0, 165, 255) if tier == "MEDIUM" else (20, 180, 20)
    h, w  = frame.shape[:2]
    label = f"ML: {cls.upper()} {conf}%"
    tw    = min(len(label) * 11 + 12, w - 20)
    x0    = w - tw - 10
    cv2.rectangle(frame, (x0, 8), (x0 + tw, 34), color, -1)
    cv2.putText(frame, label, (x0 + 6, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 1)


def _dominant_class(behavior_by_frame: dict) -> str:
    if not behavior_by_frame:
        return "Unknown"
    classes = [v.get("class", "Unknown") for v in behavior_by_frame.values() if v.get("class")]
    return Counter(classes).most_common(1)[0][0] if classes else "Unknown"


def _dominant_class_with_conf(behavior_by_frame: dict) -> tuple[str, float]:
    if not behavior_by_frame:
        return "Unknown", 0.0
    entries = [
        (v.get("class", "Unknown"), v.get("confidence", 0.0))
        for v in behavior_by_frame.values() if v.get("class")
    ]
    if not entries:
        return "Unknown", 0.0
    cls_votes: dict[str, list[float]] = {}
    for cls, conf in entries:
        cls_votes.setdefault(cls, []).append(conf)
    dominant = max(cls_votes, key=lambda c: len(cls_votes[c]))
    avg_conf  = sum(cls_votes[dominant]) / len(cls_votes[dominant])
    return dominant, round(avg_conf, 3)


def _ml_boosted_threat(
    score: float, _level: str, ml_class: str, ml_conf: float
) -> tuple[float, str]:
    """Boost threat score when ML detects high-threat activity with high confidence."""
    _HIGH  = {"Abuse", "Assault", "Shooting", "Robbery", "Fighting"}
    _MED   = {"Burglary", "Arrest", "Explosion"}
    boost  = 0.0
    if ml_class in _HIGH and ml_conf >= 0.65:
        boost = min(15.0, ml_conf * 18.0)
    elif ml_class in _MED and ml_conf >= 0.60:
        boost = min(8.0, ml_conf * 10.0)
    new_score = min(100.0, score + boost)
    if new_score >= 75:
        new_level = "CRITICAL"
    elif new_score >= 50:
        new_level = "HIGH"
    elif new_score >= 25:
        new_level = "ELEVATED"
    else:
        new_level = "LOW"
    return round(new_score, 2), new_level


def _build_ml_summary(behavior_by_frame: dict) -> dict:
    if not behavior_by_frame:
        return {}
    entries = [(v.get("class", "?"), v.get("confidence", 0.0)) for v in behavior_by_frame.values()]
    counter = Counter(c for c, _ in entries)
    total   = len(entries)
    dominant, conf = _dominant_class_with_conf(behavior_by_frame)
    return {
        "dominant_class":      dominant,
        "dominant_confidence": conf,
        "class_distribution":  {
            cls: {"count": cnt, "pct": round(cnt / total * 100, 1)}
            for cls, cnt in counter.most_common()
        },
        "frames_classified":   total,
    }


video_pipeline = VideoIntelligencePipeline()
