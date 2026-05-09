"""
CSV evidence parser — extracts structured records and metadata.
"""
import csv
import io
import json
from app.core.logging import logger


def parse_csv(file_path: str) -> dict:
    records = []
    headers = []
    try:
        with open(file_path, newline="", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []
            for row in reader:
                records.append(dict(row))
    except Exception as e:
        logger.error(f"CSV parse error: {e}")
        return {"error": str(e), "records": [], "headers": []}

    summary = {
        "record_count": len(records),
        "headers": headers,
        "records": records[:100],  # cap to avoid memory blow-up
        "raw_preview": json.dumps(records[:5], indent=2),
    }
    return summary
