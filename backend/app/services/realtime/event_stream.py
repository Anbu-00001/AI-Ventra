"""
Server-Sent Events (SSE) stream for analysis progress.
Provides a streaming alternative to WebSocket.
"""
import asyncio
import json
from typing import AsyncGenerator
from app.core.constants import ANALYSIS_STAGES


async def analysis_progress_stream(file_id: str) -> AsyncGenerator[str, None]:
    """
    Simulates cinematic stage-by-stage progress for the frontend.
    In production, real stage completion events would be emitted here.
    """
    stage_details = {
        "decrypting evidence": "AES-256 decryption layer identified - unlocking evidence payload",
        "extracting entities": "Neural NLP pipeline extracting forensic entities",
        "building evidence graph": "Graph engine mapping suspect, device, location, and timestamp nodes",
        "reconstructing timeline": "Temporal correlation engine reconstructing incident sequence",
        "detecting anomalies": "Behavioral baseline comparison - anomaly vectors identified",
        "generating verdict": "Synthesizing cross-stream intelligence for final triage report",
    }

    for i, stage in enumerate(ANALYSIS_STAGES):
        progress = int(((i + 1) / len(ANALYSIS_STAGES)) * 100)
        event = {
            "type": "stage_update",
            "file_id": file_id,
            "stage": stage,
            "stage_label": stage.title(),
            "progress": progress,
            "detail": stage_details.get(stage, "Processing..."),
        }
        yield f"data: {json.dumps(event)}\n\n"
        await asyncio.sleep(0.8)  # cinematic pacing

    yield f"data: {json.dumps({'type': 'complete', 'file_id': file_id, 'progress': 100})}\n\n"
