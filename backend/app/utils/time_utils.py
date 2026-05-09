"""Time utility helpers."""
from datetime import datetime, timedelta


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def format_duration(minutes: float) -> str:
    h = int(minutes // 60)
    m = int(minutes % 60)
    return f"{h}h {m}m" if h else f"{m}m"


def ts_to_iso(ts_str: str) -> str:
    """Best-effort conversion of various timestamp formats to ISO 8601."""
    formats = ["%I:%M %p", "%H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y %H:%M"]
    for fmt in formats:
        try:
            return datetime.strptime(ts_str.strip(), fmt).isoformat()
        except ValueError:
            continue
    return ts_str
