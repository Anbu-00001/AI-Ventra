"""Forensic Timeline Reconstruction API."""
import random
from fastapi import APIRouter, Body
from app.services.ai.timeline_builder import timeline_builder
from app.services.ingestion.storage_service import save_timeline, load_all_synthetic
from app.utils.mock_generators import build_timeline_fallback
from app.utils.response_utils import success

router = APIRouter(prefix="/timeline", tags=["timeline"])


@router.post("/reconstruct")
async def reconstruct_timeline(evidence_context: dict = Body(...)):
    """Reconstruct incident timeline from provided evidence context."""
    timeline = await timeline_builder.build(evidence_context)
    save_timeline(timeline.model_dump(), timeline.timeline_id)
    return success(timeline.model_dump(), message="Timeline reconstructed")


@router.get("/demo")
async def demo_timeline():
    """Return pre-built demo timeline — always available."""
    timeline = build_timeline_fallback()
    return success(timeline.model_dump(), message="Demo timeline")


@router.post("/from-case/{case_id}")
async def timeline_from_case(case_id: str):
    """Reconstruct timeline from REAL uploaded evidence files first, synthetic fallback second."""
    from app.services.evidence_parser import build_real_timeline

    # 1. Try building from uploaded evidence
    real = build_real_timeline()
    if real.get("events") and len(real["events"]) >= 3:
        save_timeline(real, f"{case_id}_evidence")
        return success(real, message=f"Timeline for {case_id} — {real['total_events']} events from uploaded evidence")

    # 2. Fallback to synthetic data + Ollama
    gps_data = load_all_synthetic("gps_logs")
    cctv_data = load_all_synthetic("cctv_logs")
    call_data = load_all_synthetic("call_logs")
    context = {
        "case_id": case_id,
        "gps_sample": random.choice(gps_data) if gps_data else {},
        "cctv_sample": random.choice(cctv_data) if cctv_data else {},
        "call_sample": random.choice(call_data) if call_data else {},
    }
    try:
        timeline = await timeline_builder.build(context)
        save_timeline(timeline.model_dump(), timeline.timeline_id)
        return success(timeline.model_dump(), message=f"Timeline for case {case_id}")
    except Exception:
        # Total fallback
        timeline = build_timeline_fallback()
        return success(timeline.model_dump(), message=f"Timeline for case {case_id} (fallback)")
