"""
Evidence validation — checks file integrity before ingestion.
"""
from pathlib import Path
from app.core.constants import ALLOWED_MIME_TYPES


def validate_file_type(filename: str, mime_type: str) -> tuple[bool, str]:
    ext = Path(filename).suffix.lower().lstrip(".")
    allowed_exts = {"pdf", "csv", "json", "txt", "jpg", "jpeg", "png", "tiff"}
    if ext not in allowed_exts and mime_type not in ALLOWED_MIME_TYPES:
        return False, f"File type .{ext} / {mime_type} not supported"
    return True, "ok"


def validate_file_size(size_bytes: int, max_mb: int = 50) -> tuple[bool, str]:
    max_bytes = max_mb * 1024 * 1024
    if size_bytes > max_bytes:
        return False, f"File size {size_bytes / 1024 / 1024:.1f} MB exceeds {max_mb} MB limit"
    return True, "ok"
