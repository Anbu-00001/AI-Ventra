"""
Confidence scoring for individual evidence components.
"""


def compute_evidence_confidence(
    extraction_quality: float,
    completeness: float,
    consistency: float,
    source_reliability: float = 90.0,
) -> float:
    """Weighted average confidence for a single evidence piece."""
    weights = [0.25, 0.30, 0.30, 0.15]
    scores = [extraction_quality, completeness, consistency, source_reliability]
    return round(sum(w * s for w, s in zip(weights, scores)), 1)


def classify_confidence(score: float) -> str:
    if score >= 90:
        return "VERY HIGH"
    if score >= 75:
        return "HIGH"
    if score >= 55:
        return "MEDIUM"
    if score >= 35:
        return "LOW"
    return "VERY LOW"
