"""Timeline reconstruction models."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class TimelineEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str
    event_type: str
    title: str
    description: str
    location: Optional[str] = None
    actors: list[str] = []
    confidence: float
    source: str
    is_anomaly: bool = False
    severity: Optional[str] = None
    coordinates: Optional[dict] = None
    metadata: dict = {}


class ReconstructedTimeline(BaseModel):
    timeline_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_id: str = "AIV-2041-77"
    events: list[TimelineEvent]
    total_events: int
    anomaly_count: int
    confidence_score: float
    start_time: str
    end_time: str
    duration_minutes: float
    narrative_summary: str
    key_insights: list[str]
    generated_at: datetime = Field(default_factory=datetime.utcnow)
