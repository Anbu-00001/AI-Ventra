"""
AI analysis findings models — autopsy, anomaly, classification results.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class AutopsyFindings(BaseModel):
    case_id: str = "AIV-2041-77"
    report_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cause_of_death: str
    manner_of_death: str
    tod_estimate: str
    tod_window_hours: float
    injuries: list[dict]
    toxicity_flags: list[dict]
    environmental_conflicts: list[str]
    rigor_mortis_stage: str
    livor_mortis_pattern: str
    postmortem_interval_hours: float
    confidence: float
    reasoning: str
    contributing_factors: list[str]
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class AnomalyFinding(BaseModel):
    anomaly_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_id: str = "AIV-2041-77"
    anomaly_type: str
    description: str
    severity: str
    threat_score: float
    detected_at: str
    evidence_source: str
    confidence: float
    contributing_factors: list[dict]
    recommended_action: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class AnomalyReport(BaseModel):
    case_id: str = "AIV-2041-77"
    overall_threat_level: str
    overall_threat_score: float
    anomalies: list[AnomalyFinding]
    behavioral_profile: dict
    escalation_probability: float
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class EvidenceClassificationResult(BaseModel):
    file_id: str
    category: str
    confidence: float
    sub_tags: list[str]
    priority: str
