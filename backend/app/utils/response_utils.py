"""Standard response builders for all API routes."""
from datetime import datetime


def success(data: dict | list, message: str = "Operation successful") -> dict:
    return {
        "status": "success",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "message": message,
        "data": data,
    }


def error(message: str, code: int = 400, detail: str = "") -> dict:
    return {
        "status": "error",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "message": message,
        "detail": detail,
        "code": code,
    }
