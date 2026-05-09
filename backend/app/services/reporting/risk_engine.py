"""
Risk scoring engine — computes weighted composite threat score.
"""
from app.core.constants import RISK_LEVELS


def compute_risk_score(
    autopsy_confidence: float = 0,
    anomaly_score: float = 0,
    timeline_confidence: float = 0,
    correlation_confidence: float = 0,
    evidence_count: int = 0,
) -> dict:
    weights = {
        "autopsy": 0.30,
        "anomaly": 0.35,
        "timeline": 0.20,
        "correlation": 0.15,
    }
    base_score = (
        autopsy_confidence * weights["autopsy"]
        + anomaly_score * weights["anomaly"]
        + timeline_confidence * weights["timeline"]
        + correlation_confidence * weights["correlation"]
    )
    # Evidence volume bonus (max +5)
    volume_bonus = min(5, evidence_count * 1.0)
    final_score = min(100, round(base_score + volume_bonus, 1))

    threat_level = "LOW"
    for level, (lo, hi) in RISK_LEVELS.items():
        if lo <= final_score <= hi:
            threat_level = level
            break

    return {
        "risk_score": final_score,
        "threat_level": threat_level,
        "breakdown": {
            "autopsy_contribution": round(autopsy_confidence * weights["autopsy"], 1),
            "anomaly_contribution": round(anomaly_score * weights["anomaly"], 1),
            "timeline_contribution": round(timeline_confidence * weights["timeline"], 1),
            "correlation_contribution": round(correlation_confidence * weights["correlation"], 1),
            "volume_bonus": volume_bonus,
        },
    }
