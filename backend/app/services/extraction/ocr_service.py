"""
OCR service using pytesseract for image-based evidence files.
"""
try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

from app.core.logging import logger


def ocr_image(file_path: str) -> str:
    if not OCR_AVAILABLE:
        logger.warning("pytesseract/PIL not available — OCR skipped")
        return "OCR not available — install pytesseract and Pillow."
    try:
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img)
        return text.strip()
    except Exception as e:
        logger.error(f"OCR error: {e}")
        return "OCR extraction failed."
