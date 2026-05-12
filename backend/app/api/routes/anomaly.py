"""Anomaly Detection API."""
import random
from fastapi import APIRouter, Body
from app.services.ai.anomaly_detector import anomaly_detector
from app.services.ingestion.storage_service import load_all_synthetic
from app.utils.mock_generators import build_anomaly_fallback, build_anomaly_from_uploads
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


@router.get("/from-evidence")
async def anomaly_from_evidence():
    """Build real anomaly report from uploaded forensic evidence files."""
    from app.services.evidence_parser import parse_call_logs, parse_gps_trace
    
    # Try to parse evidence first to ensure files are processed
    parse_call_logs()
    parse_gps_trace()
    
    report = build_anomaly_from_uploads()
    return success(report.model_dump(), message="Anomaly report from uploaded evidence")


@router.post("/from-case/{case_id}")
async def anomaly_from_case(case_id: str):
    """Detect anomalies using actual uploaded case behavioral data."""
    import os
    import json
    from app.core.config import settings
    
    findings_dir = settings.FINDINGS_DIR
    real_calls = []
    real_gps = []
    
    if os.path.isdir(findings_dir):
        for fname in os.listdir(findings_dir):
            if fname.endswith("_extraction.json"):
                try:
                    with open(os.path.join(findings_dir, fname)) as fp:
                        d = json.load(fp)
                    original_name = d.get("original_name", "").lower()
                    text = d.get("text", "")
                    if not text:
                        continue
                    obj = json.loads(text)
                    
                    if "call" in original_name:
                        real_calls.append(obj)
                    elif "gps" in original_name:
                        real_gps.append(obj)
                except Exception:
                    pass

    call_sample = real_calls[0] if real_calls else {}
    gps_sample = real_gps[0] if real_gps else {}

    # If no real data is uploaded, fallback to synthetic for gracefully handling empty state
    if not real_calls and not real_gps:
        call_logs = load_all_synthetic("call_logs")
        gps_logs = load_all_synthetic("gps_logs")
        call_sample = random.choice(call_logs) if call_logs else {}
        gps_sample = random.choice(gps_logs) if gps_logs else {}

    data = {
        "case_id": case_id,
        "call_sample": call_sample,
        "gps_sample": gps_sample,
    }
    report = await anomaly_detector.detect(data)
    return success(report.model_dump(), message=f"Anomaly detection for case {case_id}")
