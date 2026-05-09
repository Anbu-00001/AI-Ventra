"""
File metadata extractor — OS-level and content-level metadata.
"""
import os
import hashlib
from pathlib import Path
from datetime import datetime


def extract_metadata(file_path: str) -> dict:
    p = Path(file_path)
    stat = p.stat()
    with open(file_path, "rb") as f:
        content = f.read()

    return {
        "filename": p.name,
        "extension": p.suffix.lower(),
        "size_bytes": stat.st_size,
        "created_at": datetime.utcfromtimestamp(stat.st_ctime).isoformat(),
        "modified_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
        "sha256": hashlib.sha256(content).hexdigest(),
        "is_binary": _is_binary(content[:512]),
    }


def _is_binary(sample: bytes) -> bool:
    try:
        sample.decode("utf-8")
        return False
    except UnicodeDecodeError:
        return True
