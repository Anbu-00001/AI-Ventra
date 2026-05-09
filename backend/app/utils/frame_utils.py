"""Video and frame helper utilities."""
from __future__ import annotations

import os
from pathlib import Path


def ensure_video_dirs(*paths: str) -> None:
    for path in paths:
        Path(path).mkdir(parents=True, exist_ok=True)


def timestamp_from_frame(frame_index: int, fps: float) -> str:
    seconds = frame_index / max(fps, 1.0)
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"00:{minutes:02d}:{secs:02d}.{millis:03d}"


def public_video_url(analysis_id: str) -> str:
    return f"/api/processed-video/{analysis_id}"


def snapshot_url(analysis_id: str, filename: str) -> str:
    return f"/api/analysis/{analysis_id}/snapshot/{os.path.basename(filename)}"
