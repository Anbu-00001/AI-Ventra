"""
Static lookup tables shared across the system.
"""

# Supported file types for evidence ingestion
ALLOWED_MIME_TYPES = {
    "application/pdf": "pdf",
    "text/csv": "csv",
    "application/json": "json",
    "image/jpeg": "image",
    "image/png": "image",
    "image/tiff": "image",
    "text/plain": "txt",
}

# Evidence categories the classifier can emit
EVIDENCE_CATEGORIES = [
    "physical_evidence",
    "digital_evidence",
    "behavioral_evidence",
    "environmental_data",
    "autopsy_report",
    "gps_log",
    "cctv_log",
    "call_log",
    "financial_record",
    "forensic_image",
]

# Severity tiers for risk scoring
RISK_LEVELS = {
    "CRITICAL": (90, 100),
    "HIGH": (70, 89),
    "ELEVATED": (50, 69),
    "MODERATE": (30, 49),
    "LOW": (0, 29),
}

# Forensic stage labels shown in websocket progress events
ANALYSIS_STAGES = [
    "decrypting evidence",
    "extracting entities",
    "building evidence graph",
    "reconstructing timeline",
    "detecting anomalies",
    "generating verdict",
]

# Node types for evidence correlation graph
NODE_TYPES = ["suspect", "device", "location", "timestamp", "document"]

# Relationship labels between evidence nodes
RELATIONSHIP_TYPES = [
    "COMMUNICATED_WITH",
    "LOCATED_AT",
    "OWNS_DEVICE",
    "PRESENT_AT",
    "CONNECTED_TO",
    "CORRELATES_WITH",
    "CONTRADICTS",
    "SUPPORTS",
    "PRECEDES",
    "FOLLOWS",
]

# Postmortem indicators used in TOD estimation
TOD_INDICATORS = [
    "body_temperature",
    "rigor_mortis",
    "livor_mortis",
    "decomposition_stage",
    "stomach_contents",
    "vitreous_potassium",
    "ambient_temperature",
]

# Anomaly types the detector reports
ANOMALY_TYPES = [
    "behavioral_deviation",
    "gps_inconsistency",
    "metadata_gap",
    "communication_silence",
    "temporal_anomaly",
    "financial_irregularity",
    "route_deviation",
]
