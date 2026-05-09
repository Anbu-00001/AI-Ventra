"""End-to-end CCTV intelligence pipeline."""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from app.core.config import BASE_DIR
from app.models.schemas import VideoAnalysisReport, VideoDetection
from app.services.anomaly_engine import AnomalyEngine
from app.services.event_builder import EventBuilder
from app.services.forensic_reasoning import ForensicReasoningEngine
from app.services.motion_analyzer import MotionAnalyzer
from app.services.overlay_renderer import OverlayRenderer
from app.services.yolo_detector import yolo_detector
from app.utils.frame_utils import ensure_video_dirs, public_video_url, snapshot_url
from app.utils.json_utils import save_json


VIDEO_UPLOADS_DIR = str(BASE_DIR.parent / "uploads")
VIDEO_PROCESSED_DIR = str(BASE_DIR.parent / "processed")
VIDEO_REPORTS_DIR = str(BASE_DIR.parent / "reports")

# YOLO label colors in BGR: person=crimson, vehicle=teal, object=amber
_LABEL_COLOR = {
    "person":     (38,  26,  255),   # crimson
    "car":        (20,  240, 214),   # teal
    "truck":      (20,  200, 214),   # teal-dark
    "motorcycle": (20,  180, 214),   # teal-blue
    "cellphone":  (30,  200, 255),   # amber-ish
    "handbag":    (50,  150, 255),   # orange
}
_DEFAULT_COLOR = (200, 200, 200)


def _draw_yolo_boxes(cv2, frame, detections: list[VideoDetection]):
    """Draw YOLO bounding boxes with labels on frame in-place."""
    for d in detections:
        b = d.bbox
        color = _LABEL_COLOR.get(d.label, _DEFAULT_COLOR)
        cv2.rectangle(frame, (b.x1, b.y1), (b.x2, b.y2), color, 2)
        # label tag background
        tag = f"{d.label.upper()} {int(d.confidence * 100)}%"
        if d.track_id:
            tag = f"[{d.track_id}] {tag}"
        tag_w = min(len(tag) * 10 + 8, frame.shape[1] - b.x1)
        tag_y = max(0, b.y1 - 22)
        cv2.rectangle(frame, (b.x1, tag_y), (b.x1 + tag_w, b.y1), color, -1)
        cv2.putText(frame, tag, (b.x1 + 4, b.y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (8, 8, 8), 1)
    # corner scan accents
    h, w = frame.shape[:2]
    teal = (214, 240, 20)
    cv2.rectangle(frame, (0, 0), (28, 28), (0, 0, 0), -1)
    cv2.line(frame, (0, 0), (28, 0), teal, 2)
    cv2.line(frame, (0, 0), (0, 28), teal, 2)
    cv2.rectangle(frame, (w - 28, 0), (w, 28), (0, 0, 0), -1)
    cv2.line(frame, (w - 28, 0), (w, 0), teal, 2)
    cv2.line(frame, (w, 0), (w, 28), teal, 2)
    cv2.rectangle(frame, (0, h - 28), (28, h), (0, 0, 0), -1)
    cv2.line(frame, (0, h - 28), (0, h), teal, 2)
    cv2.line(frame, (0, h), (28, h), teal, 2)


class VideoIntelligencePipeline:
    def __init__(self) -> None:
        self.events = EventBuilder()
        self.anomalies = AnomalyEngine()
        self.reasoning = ForensicReasoningEngine()
        self.renderer = OverlayRenderer()

    async def analyze(self, source_path: str, case_id: str, progress=None) -> VideoAnalysisReport:
        import cv2

        ensure_video_dirs(VIDEO_UPLOADS_DIR, VIDEO_PROCESSED_DIR, VIDEO_REPORTS_DIR)
        analysis_id = f"vis-{uuid.uuid4().hex[:12]}"
        cap = cv2.VideoCapture(source_path)
        if not cap.isOpened():
            raise ValueError("Unable to open uploaded video. Please upload a valid MP4/MOV/AVI clip.")

        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        vid_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
        vid_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
        duration = frame_count / max(fps, 1.0)
        # Scan every ~4 frames (≈8 samples/sec for 30fps) so nothing is missed
        sample_stride = max(2, int(fps // 8))
        # Spread snapshots evenly: one every ~2 seconds across the full video
        snap_every = max(sample_stride, int(fps * 2))
        motion = MotionAnalyzer()
        all_detections: list[VideoDetection] = []
        detections_by_frame: dict[int, list[VideoDetection]] = {}
        samples = []
        snapshots: list[str] = []

        if progress:
            await progress({
                "type": "stage", "stage": "video_loaded", "progress": 8,
                "video_width": vid_width, "video_height": vid_height,
                "detail": f"{duration:.1f}s · {int(fps)}fps · {frame_count} frames · stride={sample_stride}",
            })

        frame_index = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_index % sample_stride == 0:
                detections = yolo_detector.detect(frame, frame_index, fps)
                sample = motion.analyze(frame, frame_index, fps, detections)
                all_detections.extend(detections)
                detections_by_frame[frame_index] = detections
                samples.append(sample)

                # Evenly distributed snapshots with YOLO boxes — covers full video
                if frame_index % snap_every == 0 and len(snapshots) < 12:
                    filename = f"{analysis_id}_{frame_index}.jpg"
                    path = os.path.join(VIDEO_PROCESSED_DIR, filename)
                    annotated = frame.copy()
                    _draw_yolo_boxes(cv2, annotated, detections)
                    cv2.imwrite(path, annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])
                    snapshots.append(snapshot_url(analysis_id, filename))

                if progress and frame_count:
                    pct = 8 + int((frame_index / frame_count) * 52)
                    await progress({
                        "type": "detection",
                        "stage": "yolo_motion_scan",
                        "progress": min(60, pct),
                        "frame": frame_index,
                        "video_width": vid_width,
                        "video_height": vid_height,
                        "detections": [d.model_dump() for d in detections[:12]],
                        "motion": sample.model_dump(),
                    })
            frame_index += 1
        cap.release()

        if progress:
            await progress({"type": "stage", "stage": "anomaly_fusion", "progress": 68,
                            "detail": f"Fusing {len(samples)} motion samples into forensic timeline"})

        anomaly_rows = self.anomalies.analyze(samples)
        timeline = self.events.build_events(anomaly_rows)
        entities = self.events.summarize_entities(all_detections)
        threat_score, threat_level = self.events.threat_score(anomaly_rows, all_detections)
        waveform = [round(min(1.0, s.motion_score / 100.0), 3) for s in samples[:180]]
        reasoning = await self.reasoning.explain(threat_level, threat_score, timeline, anomaly_rows)

        if progress:
            await progress({"type": "stage", "stage": "overlay_render", "progress": 82,
                            "detail": "Rendering YOLO + HUD tactical video overlay"})

        processed_path = os.path.join(VIDEO_PROCESSED_DIR, f"{analysis_id}.mp4")
        self.renderer.render(source_path, processed_path, detections_by_frame, timeline, sample_stride)

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
                "yolo": yolo_detector.status.__dict__,
                "sample_stride": sample_stride,
                "detector": "YOLOv8n pretrained COCO",
                "analysis_note": "Forensic anomaly intelligence — no crime classification performed.",
            },
        )
        save_json(report.model_dump(), os.path.join(VIDEO_REPORTS_DIR, f"{analysis_id}.json"))
        if progress:
            await progress({"type": "complete", "stage": "complete", "progress": 100,
                            "analysis_id": analysis_id, "report": report.model_dump()})
        return report


video_pipeline = VideoIntelligencePipeline()
