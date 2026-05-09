"""
Text chunker — splits evidence text into overlapping chunks for embedding.
Forensic-aware: preserves sentence boundaries and timestamp contexts.
"""
import re
from app.core.config import settings


def chunk_text(text: str, chunk_size: int = None, overlap: int = None) -> list[str]:
    chunk_size = chunk_size or settings.CHUNK_SIZE
    overlap = overlap or settings.CHUNK_OVERLAP

    # Normalize whitespace
    text = re.sub(r'\n{3,}', '\n\n', text.strip())
    sentences = re.split(r'(?<=[.!?])\s+', text)

    chunks = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) + 1 <= chunk_size:
            current = (current + " " + sent).strip()
        else:
            if current:
                chunks.append(current)
            # Start new chunk with overlap from end of previous
            if current and overlap > 0:
                words = current.split()
                overlap_text = " ".join(words[-max(1, overlap // 8):])
                current = (overlap_text + " " + sent).strip()
            else:
                current = sent

    if current:
        chunks.append(current)

    # Filter empty / trivially short chunks
    return [c for c in chunks if len(c) > 30]


def chunk_with_metadata(text: str, source: str, file_id: str) -> list[dict]:
    raw_chunks = chunk_text(text)
    return [
        {
            "chunk_id": f"{file_id}_{i}",
            "source": source,
            "file_id": file_id,
            "text": chunk,
            "char_start": text.find(chunk[:40]),
            "index": i,
        }
        for i, chunk in enumerate(raw_chunks)
    ]
