"""Shared schemas for CCTV forensic video intelligence."""
from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int


class VideoDetection(BaseModel):
    frame_index: int
    timestamp: str
    label: str
    confidence: float
    bbox: BoundingBox
    track_id: str | None = None
    centroid: tuple[int, int] | None = None


class MotionSample(BaseModel):
    frame_index: int
    timestamp: str
    motion_score: float
    active_area_ratio: float
    flow_magnitude: float
    people_count: int
    vehicle_count: int
    subject_tracks: dict[str, list[tuple[int, int]]] = Field(default_factory=dict)


class ForensicEvent(BaseModel):
    id: str
    timestamp: str
    event: str
    confidence: float
    severity: str
    category: str
    evidence: list[str] = Field(default_factory=list)
    frame_index: int | None = None


class MovementAnomaly(BaseModel):
    timestamp: str
    type: str
    confidence: float
    severity: str
    description: str
    metrics: dict[str, Any] = Field(default_factory=dict)


class EntitySummary(BaseModel):
    label: str
    count: int
    max_confidence: float
    first_seen: str
    last_seen: str


class ReasoningOutput(BaseModel):
    threat_level: str
    reasoning: list[str]
    narration: list[str]
    rag_context: list[dict[str, Any]] = Field(default_factory=list)
    ollama_used: bool = False


class VideoAnalysisReport(BaseModel):
    analysis_id: str
    case_id: str
    source_video: str
    processed_video_url: str | None = None
    duration_seconds: float
    fps: float
    frame_count: int
    processed_frames: int
    threat_score: int
    threat_level: str
    detected_entities: list[EntitySummary]
    event_timeline: list[ForensicEvent]
    movement_anomalies: list[MovementAnomaly]
    reasoning_engine: ReasoningOutput
    confidence_waveform: list[float]
    snapshots: list[str] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)
