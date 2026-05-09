"""
Evidence ingestion and classification models.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class EvidenceFile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_name: str
    file_type: str  # pdf | csv | json | image | txt
    mime_type: str
    size_bytes: int
    upload_timestamp: datetime = Field(default_factory=datetime.utcnow)
    case_id: str = "AIV-2041-77"
    status: str = "uploaded"
    checksum: Optional[str] = None
    storage_path: str = ""
    extracted_path: str = ""


class EvidenceClassification(BaseModel):
    file_id: str
    category: str
    sub_category: Optional[str] = None
    confidence: float
    tags: list[str] = []
    classified_at: datetime = Field(default_factory=datetime.utcnow)


class ExtractedContent(BaseModel):
    file_id: str
    raw_text: str
    entities: list[dict] = []
    timestamps: list[str] = []
    locations: list[str] = []
    persons: list[str] = []
    metadata: dict = {}
    extraction_method: str = "pdf_parser"
    extracted_at: datetime = Field(default_factory=datetime.utcnow)


class UploadResponse(BaseModel):
    success: bool
    file_id: str
    filename: str
    file_type: str
    size_bytes: int
    message: str
    case_id: str = "AIV-2041-77"
