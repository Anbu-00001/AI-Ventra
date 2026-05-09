"""
File ingestion service — handles multipart uploads, validates, stores,
and triggers the extraction pipeline.
"""
import os
import uuid
import hashlib
from pathlib import Path
from fastapi import UploadFile

from app.core.config import settings
from app.core.constants import ALLOWED_MIME_TYPES
from app.core.logging import logger
from app.models.evidence import EvidenceFile
from app.utils.file_utils import ensure_dir, safe_filename


MAX_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


async def ingest_file(upload: UploadFile, case_id: str = "AIV-2041-77") -> EvidenceFile:
    ensure_dir(settings.UPLOADS_DIR)

    content = await upload.read()
    size = len(content)

    if size > MAX_BYTES:
        raise ValueError(f"File {upload.filename} exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit")

    mime = upload.content_type or "application/octet-stream"
    file_type = ALLOWED_MIME_TYPES.get(mime, "unknown")
    if file_type == "unknown":
        # Guess from extension
        ext = Path(upload.filename or "").suffix.lower().lstrip(".")
        file_type = ext if ext in ("pdf", "csv", "json", "txt") else "unknown"

    file_id = str(uuid.uuid4())
    safe_name = f"{file_id}_{safe_filename(upload.filename or 'evidence')}"
    storage_path = os.path.join(settings.UPLOADS_DIR, safe_name)

    with open(storage_path, "wb") as f:
        f.write(content)

    checksum = hashlib.sha256(content).hexdigest()
    logger.info(f"Ingested: {upload.filename} → {file_id} ({size} bytes)")

    return EvidenceFile(
        id=file_id,
        filename=safe_name,
        original_name=upload.filename or "unknown",
        file_type=file_type,
        mime_type=mime,
        size_bytes=size,
        case_id=case_id,
        status="uploaded",
        checksum=checksum,
        storage_path=storage_path,
    )
