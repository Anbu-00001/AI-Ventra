"""Evidence correlation graph models."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class CorrelationNode(BaseModel):
    id: str
    label: str
    meta: str
    node_type: str
    confidence: float
    evidence_sources: list[str] = []
    attributes: dict = {}


class CorrelationEdge(BaseModel):
    source: str
    target: str
    relationship: str
    strength: str
    confidence: float
    timestamp: Optional[str] = None
    explanation: str = ""


class CorrelationDetails(BaseModel):
    reasons: list[str]
    overall_strength: float
    temporal_overlap: float
    location_proximity: float
    device_fingerprint_match: Optional[float] = None
    behavioral_pattern_match: Optional[float] = None


class CorrelationGraph(BaseModel):
    graph_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_id: str = "AIV-2041-77"
    nodes: list[CorrelationNode]
    edges: list[CorrelationEdge]
    total_nodes: int
    total_edges: int
    high_confidence_paths: list[list[str]] = []
    ai_insight: str
    insight_confidence: float
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class TriageReport(BaseModel):
    report_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_id: str = "AIV-2041-77"
    risk_score: float
    threat_level: str
    verdict: str
    reasoning: str
    supporting_evidence: list[dict]
    key_findings: list[str]
    recommended_actions: list[str]
    confidence_score: float
    autopsy_summary: Optional[dict] = None
    timeline_summary: Optional[dict] = None
    anomaly_summary: Optional[dict] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    analyst_id: str = "AIVENTRA-OMEGA-7"
