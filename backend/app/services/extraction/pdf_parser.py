"""
PDF text extraction using pdfplumber with fallback to raw text.
"""
import io
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

from app.core.logging import logger


def extract_text_from_pdf(file_path: str) -> str:
    if not PDFPLUMBER_AVAILABLE:
        logger.warning("pdfplumber not installed — returning placeholder")
        return _read_as_text(file_path)

    try:
        text_parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_parts.append(t)
        return "\n\n".join(text_parts)
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return _read_as_text(file_path)


def _read_as_text(path: str) -> str:
    try:
        with open(path, "r", errors="ignore") as f:
            return f.read()
    except Exception:
        return "Unable to extract text from file."
