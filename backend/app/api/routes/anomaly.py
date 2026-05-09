"""Anomaly Detection API."""
import random
from fastapi import APIRouter, Body
from app.services.ai.anomaly_detector import anomaly_detector
from app.services.ingestion.storage_service import load_all_synthetic
from app.utils.mock_generators import build_anomaly_fallback
from app.models.findings import AnomalyReport
from app.utils.response_utils import success

router = APIRouter(prefix="/anomaly", tags=["anomaly"])


@router.post("/detect")
async def detect_anomalies(evidence_data: dict = Body(...)):
    """Run anomaly detection on provided behavioral/evidence data."""
    report = await anomaly_detector.detect(evidence_data)
    return success(report.model_dump(), message="Anomaly detection complete")


@router.get("/demo")
async def demo_anomalies():
    """Return pre-generated demo anomaly report."""
    anomalies = build_anomaly_fallback()
    report = AnomalyReport(
        overall_threat_level="HIGH",
        overall_threat_score=82.0,
        anomalies=anomalies,
        behavioral_profile={
            "deviation_score": 68.4,
            "pattern_shift": "HIGH",
            "baseline_comparison": "Subject deviated from baseline across 5 behavioral vectors",
        },
        escalation_probability=87.0,
    )
    return success(report.model_dump(), message="Demo anomaly report")


@router.post("/from-case/{case_id}")
async def anomaly_from_case(case_id: str):
    """Detect anomalies using synthetic case behavioral data."""
    call_logs = load_all_synthetic("call_logs")
    gps_logs = load_all_synthetic("gps_logs")
    data = {
        "case_id": case_id,
        "call_sample": random.choice(call_logs) if call_logs else {},
        "gps_sample": random.choice(gps_logs) if gps_logs else {},
    }
    report = await anomaly_detector.detect(data)
    return success(report.model_dump(), message=f"Anomaly detection for case {case_id}")
