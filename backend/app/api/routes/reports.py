"""
Final Triage Report API.
Generates composite AI risk assessment from all evidence streams.
"""
import os
import random
from fastapi import APIRouter, Body
from app.services.reporting.verdict_generator import verdict_generator
from app.services.reporting.risk_engine import compute_risk_score
from app.services.ingestion.storage_service import save_report, load_all_synthetic
from app.utils.mock_generators import build_timeline_fallback, build_anomaly_fallback, build_correlation_fallback
from app.utils.response_utils import success
from app.core.config import settings
from app.utils.json_utils import load_json

router = APIRouter(prefix="/reports", tags=["reports"])
report_router = APIRouter(prefix="/report", tags=["report"])


@router.post("/generate")
async def generate_report(
    autopsy_id: str = Body(None, embed=True),
    timeline_id: str = Body(None, embed=True),
    case_id: str = Body("AIV-2041-77", embed=True),
):
    """Generate a full triage report from stored analysis outputs."""
    autopsy = None
    if autopsy_id:
        autopsy = load_json(os.path.join(settings.FINDINGS_DIR, f"{autopsy_id}_autopsy.json"))

    report = await verdict_generator.generate(autopsy=autopsy)
    save_report(report.model_dump(), report.report_id)
    return success(report.model_dump(), message="Triage report generated")


report_router.add_api_route("/generate", generate_report, methods=["POST"])


@router.get("/demo")
async def demo_report():
    """Full demo triage report using all fallback data."""
    timeline = build_timeline_fallback()
    anomalies = build_anomaly_fallback()
    correlation = build_correlation_fallback()

    autopsy_mock = {
        "cause_of_death": "Blunt Force Trauma to cranial region",
        "manner_of_death": "homicide",
        "tod_estimate": "02:00 AM – 04:00 AM",
        "confidence": 94.0,
    }

    report = await verdict_generator.generate(
        autopsy=autopsy_mock,
        timeline={"total_events": timeline.total_events, "anomaly_count": timeline.anomaly_count},
        anomaly={"overall_threat_score": 82.0, "overall_threat_level": "HIGH"},
        correlation={"total_nodes": correlation.total_nodes, "insight_confidence": 94.0},
    )
    save_report(report.model_dump(), report.report_id)
    return success(report.model_dump(), message="Demo triage report")


@router.get("/risk-score")
async def get_risk_score(
    autopsy_confidence: float = 88,
    anomaly_score: float = 82,
    timeline_confidence: float = 91,
    correlation_confidence: float = 89,
    evidence_count: int = 5,
):
    """Compute composite risk score from component confidence values."""
    result = compute_risk_score(
        autopsy_confidence, anomaly_score,
        timeline_confidence, correlation_confidence, evidence_count,
    )
    return success(result, message="Risk score computed")


@router.get("/list")
async def list_reports():
    """List all saved triage reports."""
    results = []
    if os.path.isdir(settings.REPORTS_DIR):
        for fname in sorted(os.listdir(settings.REPORTS_DIR)):
            if fname.endswith(".json"):
                data = load_json(os.path.join(settings.REPORTS_DIR, fname))
                if data:
                    results.append({
                        "report_id": data.get("report_id"),
                        "case_id": data.get("case_id"),
                        "threat_level": data.get("threat_level"),
                        "risk_score": data.get("risk_score"),
                        "generated_at": data.get("generated_at"),
                    })
    return success(results, message=f"{len(results)} reports found")
