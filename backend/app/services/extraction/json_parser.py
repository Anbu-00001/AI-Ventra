"""
JSON evidence parser — validates and normalises JSON evidence files.
"""
import json
from app.core.logging import logger


def parse_json_evidence(file_path: str) -> dict:
    try:
        with open(file_path, encoding="utf-8") as f:
            data = json.load(f)
        return {"valid": True, "data": data, "keys": list(data.keys()) if isinstance(data, dict) else []}
    except Exception as e:
        logger.error(f"JSON parse error: {e}")
        return {"valid": False, "error": str(e), "data": {}}
