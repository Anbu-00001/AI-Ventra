"""Evidence Correlation Engine API."""
import random
from fastapi import APIRouter, Body
from app.services.ai.correlation_engine import correlation_engine
from app.services.ingestion.storage_service import save_correlation, load_all_synthetic
from app.utils.mock_generators import build_correlation_fallback, build_evidence_correlation_from_uploads
from app.utils.response_utils import success

router = APIRouter(prefix="/correlation", tags=["correlation"])


@router.post("/build")
@router.post("/analyze")
async def analyze_correlation(entities_data: dict = Body(...)):
    """Build a correlation graph from provided entity data."""
    graph = await correlation_engine.correlate(entities_data)
    save_correlation(graph.model_dump(), graph.graph_id)
    return success(graph.model_dump(), message="Correlation graph generated")


@router.get("/demo")
async def demo_correlation():
    """Return pre-built demo correlation graph."""
    graph = build_correlation_fallback()
    return success(graph.model_dump(), message="Demo correlation graph")


@router.get("/from-evidence")
async def correlate_from_evidence():
    """Build real correlation graph by parsing all uploaded evidence files."""
    graph = build_evidence_correlation_from_uploads()
    save_correlation(graph.model_dump(), graph.graph_id)
    return success(graph.model_dump(), message="Evidence correlation built from uploaded files")


@router.post("/from-case/{case_id}")
async def correlate_case(case_id: str):
    """Generate correlation graph from all evidence in a case."""
    case_files = load_all_synthetic("case_files")
    entities = {}
    if case_files:
        sample = random.choice(case_files)
        entities = sample.get("entities", {})
    graph = await correlation_engine.correlate(entities or {"case_id": case_id})
    save_correlation(graph.model_dump(), graph.graph_id)
    return success(graph.model_dump(), message=f"Correlation for case {case_id}")
