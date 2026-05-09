"""FastAPI routes for AI-powered CCTV visual intelligence."""
from __future__ import annotations

import os
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from app.services.video_pipeline import VIDEO_PROCESSED_DIR, VIDEO_REPORTS_DIR, VIDEO_UPLOADS_DIR, video_pipeline
from app.utils.file_utils import safe_filename
from app.utils.frame_utils import ensure_video_dirs
from app.utils.json_utils import load_json
from app.utils.response_utils import success
from app.websocket.stream_manager import video_stream_manager


router = APIRouter(tags=["video-analysis"])


@router.post("/upload-video")
async def upload_video(file: UploadFile = File(...), case_id: str = Form("AIV-2041-77")):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    ext = Path(file.filename).suffix.lower()
    if ext not in {".mp4", ".mov", ".avi", ".mkv", ".webm"}:
        raise HTTPException(status_code=400, detail="Upload a CCTV video file: mp4, mov, avi, mkv, or webm")

    ensure_video_dirs(VIDEO_UPLOADS_DIR, VIDEO_PROCESSED_DIR, VIDEO_REPORTS_DIR)
    upload_name = f"{uuid.uuid4().hex}_{safe_filename(file.filename)}"
    upload_path = os.path.join(VIDEO_UPLOADS_DIR, upload_name)
    with open(upload_path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    async def progress(payload: dict) -> None:
        await video_stream_manager.broadcast({"analysis_file": file.filename, **payload})

    try:
        report = await video_pipeline.analyze(upload_path, case_id=case_id, progress=progress)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Video analysis failed: {exc}") from exc

    return success(report.model_dump(), message="CCTV forensic intelligence analysis complete")


@router.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str):
    report = load_json(os.path.join(VIDEO_REPORTS_DIR, f"{analysis_id}.json"))
    if not report:
        raise HTTPException(status_code=404, detail="Analysis report not found")
    return success(report, message="Analysis report retrieved")


@router.get("/processed-video/{analysis_id}")
async def get_processed_video(analysis_id: str):
    path = os.path.join(VIDEO_PROCESSED_DIR, f"{analysis_id}.mp4")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Processed video not found")
    return FileResponse(path, media_type="video/mp4", filename=f"{analysis_id}_aiventra_overlay.mp4")


@router.get("/analysis/{analysis_id}/snapshot/{filename}")
async def get_snapshot(analysis_id: str, filename: str):
    if not filename.startswith(analysis_id):
        raise HTTPException(status_code=400, detail="Invalid snapshot id")
    path = os.path.join(VIDEO_PROCESSED_DIR, safe_filename(filename))
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return FileResponse(path, media_type="image/jpeg")


@router.websocket("/live-analysis")
async def live_analysis(websocket: WebSocket):
    await video_stream_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        video_stream_manager.disconnect(websocket)
