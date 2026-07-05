from __future__ import annotations
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def compute_image_phash(filepath):
    try:
        import imagehash
        from PIL import Image
        return str(imagehash.phash(Image.open(filepath)))
    except Exception as exc:
        logger.warning("phash failed for %s: %s", filepath, exc)
        return None


def extract_text(filepath, filetype):
    ft = filetype.lower().lstrip(".")
    try:
        if ft == "pdf":  return _extract_pdf(filepath)
        if ft == "docx": return _extract_docx(filepath)
        if ft == "txt":  return _extract_txt(filepath)
    except Exception as exc:
        logger.warning("Text extraction failed for %s: %s", filepath, exc)
    return None


def _extract_pdf(filepath):
    import fitz
    doc = fitz.open(filepath)
    parts = [page.get_text() for page in doc]
    doc.close()
    text = "\n".join(parts).strip()
    return text if text else None


def _extract_docx(filepath):
    from docx import Document
    doc = Document(filepath)
    text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return text if text else None


def _extract_txt(filepath):
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        text = f.read().strip()
    return text if text else None


def get_embedding(text, model):
    return model.encode(text, show_progress_bar=False).tolist()


def cosine_similarity(a, b):
    import math
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def calculate_value_score(file_record, duplicate_count: int, has_similar_version: bool) -> float:
    score = 100.0

    # Duplicate penalty
    score -= (max(0, duplicate_count - 1)) * 10

    # Age penalty (days since modified_date, cap at 40)
    try:
        from datetime import datetime, timezone
        mod = datetime.fromisoformat(file_record.modified_date.replace('Z', '+00:00'))
        if mod.tzinfo is None:
            mod = mod.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        days = (now - mod).days
    except Exception:
        days = 0
    age_penalty = min(40, days // 30)
    score -= age_penalty

    # Low-value filename patterns
    fname_lower = file_record.filename.lower()
    low_value_patterns = ["copy", "(1)", "(2)", "(3)", "temp", "tmp", "download"]
    if any(p in fname_lower for p in low_value_patterns):
        score -= 20

    # Screenshot / low-value file type
    import re
    import os
    stem = os.path.splitext(fname_lower)[0]
    ft = file_record.filetype.lower().lstrip('.')
    is_screenshot = 'screenshot' in fname_lower or bool(re.match(r'^img_\d+$', stem))
    if ft in {'tmp', 'log', 'cache'} or is_screenshot:
        score -= 15

    # Important document bonus
    important_keywords = ["resume", "cv", "certificate", "passport", "contract", "invoice", "report"]
    if ft in {'pdf', 'docx'} and any(k in fname_lower for k in important_keywords):
        score += 15

    return max(0.0, min(100.0, score))


def calculate_days_since_modified(modified_date_str: str) -> int:
    try:
        from datetime import datetime, timezone
        mod = datetime.fromisoformat(modified_date_str.replace('Z', '+00:00'))
        if mod.tzinfo is None:
            mod = mod.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - mod).days
    except Exception:
        return 0


def generate_recommendation(
    score: float,
    duplicate_count: int,
    has_similar_version: bool,
    days_since_modified: int,
) -> str:
    if score < 40:
        label = "Safe to delete"
    elif score <= 70:
        label = "Archive"
    else:
        label = "Keep"

    parts = []
    if duplicate_count > 1:
        parts.append(f"{duplicate_count} duplicate copies exist")
    if days_since_modified > 365:
        years = round(days_since_modified / 365)
        parts.append(f"hasn't been modified in {years} year{'s' if years != 1 else ''}")
    elif days_since_modified > 30:
        months = round(days_since_modified / 30)
        parts.append(f"hasn't been modified in {months} month{'s' if months != 1 else ''}")
    if has_similar_version:
        parts.append("a similar version exists")

    if not parts:
        if score > 70:
            parts.append("This appears to be a unique important file")
        else:
            parts.append("Low value file type or naming pattern detected")

    reason = " and ".join(parts)
    if not reason.endswith('.'):
        reason += '.'
    reason = reason[0].upper() + reason[1:]
    return f"{label}: {reason}"
