"""
Evidence upload endpoint.
Ingests a file, classifies it, extracts text, embeds into FAISS, and
optionally streams progress via SSE.
"""
import os
from fastapi import APIRouter, File, UploadFile, Form, BackgroundTasks, Query
from fastapi.responses import StreamingResponse

from app.services.ingestion.file_service import ingest_file
from app.services.extraction.pdf_parser import extract_text_from_pdf
from app.services.extraction.csv_parser import parse_csv
from app.services.extraction.json_parser import parse_json_evidence
from app.services.extraction.ocr_service import ocr_image
from app.services.extraction.metadata_extractor import extract_metadata
from app.services.ai.evidence_classifier import evidence_classifier
from app.services.ai.entity_extractor import entity_extractor
from app.services.rag.chunker import chunk_with_metadata
from app.services.rag.embeddings import embed_texts
from app.services.rag.vector_store import vector_store
from app.services.ingestion.storage_service import save_finding
from app.services.realtime.event_stream import analysis_progress_stream
from app.utils.response_utils import success, error
from app.utils.file_utils import ensure_dir
from app.utils.json_utils import save_json
from app.core.config import settings
from app.core.logging import logger

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("")
async def upload_evidence(
    file: UploadFile = File(...),
    case_id: str = Form("AIV-2041-77"),
    background_tasks: BackgroundTasks = None,
):
    """
    Upload a forensic evidence file.
    Returns immediately with file metadata; indexing happens in background.
    """
    try:
        ev = await ingest_file(file, case_id=case_id)
    except ValueError as e:
        return error(str(e), code=413)

    # Background: extract → classify → embed
    if background_tasks:
        background_tasks.add_task(_process_evidence, ev.id, ev.storage_path, ev.file_type, ev.original_name)

    return success(
        {
            "file_id": ev.id,
            "filename": ev.original_name,
            "file_type": ev.file_type,
            "size_bytes": ev.size_bytes,
            "case_id": ev.case_id,
            "status": "uploaded — processing in background",
        },
        message="Evidence file ingested successfully",
    )


async def _process_evidence(file_id: str, path: str, file_type: str, original_name: str):
    """Background task: extract text → classify → embed → save."""
    logger.info(f"Background processing: {file_id}")

    # 1. Extract text
    if file_type == "pdf":
        text = extract_text_from_pdf(path)
    elif file_type == "csv":
        csv_data = parse_csv(path)
        text = csv_data.get("raw_preview", "")
    elif file_type == "json":
        json_data = parse_json_evidence(path)
        import json
        text = json.dumps(json_data.get("data", {}))[:2000]
    elif file_type == "image":
        text = ocr_image(path)
    else:
        try:
            with open(path, "r", errors="ignore") as f:
                text = f.read()[:3000]
        except Exception:
            text = ""

    # 2. Classify
    classification = await evidence_classifier.classify(text[:500], original_name, file_type)
    classification.file_id = file_id

    # 3. Extract entities
    entities = await entity_extractor.extract(text[:2000])
    metadata = extract_metadata(path)

    # 4. Chunk + embed + add to FAISS
    chunks = chunk_with_metadata(text or f"Evidence file: {original_name}", original_name, file_id)
    if chunks:
        chunk_texts = [c["text"] for c in chunks]
        embeddings = await embed_texts(chunk_texts)
        vector_store.add(embeddings, chunks)
        vector_store.save()

    # 5. Persist
    extracted_payload = {
        "file_id": file_id,
        "original_name": original_name,
        "file_type": file_type,
        "text": text,
        "text_preview": text[:500],
        "metadata": metadata,
        "classification": classification.model_dump(),
        "entities": entities,
        "chunk_count": len(chunks),
    }
    ensure_dir(settings.EXTRACTED_DIR)
    save_json(extracted_payload, os.path.join(settings.EXTRACTED_DIR, f"{file_id}.json"))
    save_finding(extracted_payload, file_id, "extraction")

    logger.info(f"Evidence processed: {file_id} — {len(chunks)} chunks embedded")


@router.get("/stream/{file_id}")
async def stream_analysis_progress(file_id: str):
    """Server-Sent Events stream of analysis stage progress."""
    return StreamingResponse(
        analysis_progress_stream(file_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/status/{file_id}")
async def get_processing_status(file_id: str):
    from app.services.ingestion.storage_service import load_finding
    data = load_finding(file_id, "extraction")
    if data:
        return success({"file_id": file_id, "status": "processed", "data": data})
    return success({"file_id": file_id, "status": "pending"})
