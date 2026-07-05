from contextlib import asynccontextmanager
import hashlib
import logging
import os
import shutil
from datetime import datetime, timezone
from itertools import combinations
from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_connection
from models import (
    DuplicateGroup, FileRecord, HealthResponse,
    ScoreAllResponse, ScanResponse, SearchResult,
    SimilarImagePair, SimilarPair,
    SimulateDeleteRequest, SimulateDeleteResponse, StatsResponse,
)
from processing import (
    calculate_days_since_modified,
    calculate_value_score,
    compute_image_phash,
    cosine_similarity,
    extract_text,
    generate_recommendation,
    get_embedding,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

UPLOAD_DIR        = os.path.join(os.path.dirname(__file__), "uploaded_files")
EMBED_MODEL_NAME  = "all-MiniLM-L6-v2"
SIMILARITY_THRESH = 0.85
IMAGE_TYPES       = {"jpg", "jpeg", "png", "bmp", "gif", "webp", "tiff"}
PHASH_MAX_HAMMING = 10

_embed_model = None
_embed_cache: dict[int, list[float]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _embed_model
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    init_db()
    logger.info("Loading sentence-transformer model '%s'...", EMBED_MODEL_NAME)
    try:
        from sentence_transformers import SentenceTransformer
        _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
        logger.info("Embedding model loaded successfully.")
    except Exception as exc:
        logger.error("Failed to load embedding model: %s", exc)
        _embed_model = None
    yield
    _embed_model = None


app = FastAPI(
    title="StorageIQ API",
    description="Backend API for the StorageIQ file management system.",
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _duplicate_groups(conn) -> List[DuplicateGroup]:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT filehash FROM files
        WHERE status = 'active'
        GROUP BY filehash HAVING COUNT(*) > 1
    """)
    dup_hashes = [row["filehash"] for row in cursor.fetchall()]
    groups: List[DuplicateGroup] = []
    for fhash in dup_hashes:
        cursor.execute(
            "SELECT * FROM files WHERE filehash = ? AND status = 'active' ORDER BY id",
            (fhash,),
        )
        rows = cursor.fetchall()
        files = [FileRecord(**dict(r)) for r in rows]
        wasted = files[0].filesize * (len(files) - 1)
        groups.append(DuplicateGroup(
            filehash=fhash, files=files, count=len(files), wasted_bytes=wasted
        ))
    return groups


def _similar_text_pairs(conn, exact_hashes: set) -> List[SimilarPair]:
    if _embed_model is None:
        return []
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM files
        WHERE status = 'active'
          AND extracted_text IS NOT NULL
          AND extracted_text != ''
        ORDER BY id
    """)
    rows = cursor.fetchall()
    records = [FileRecord(**dict(r)) for r in rows]
    if len(records) < 2:
        return []
    embed_map: dict[int, list[float]] = {}
    for rec in records:
        try:
            embed_map[rec.id] = get_embedding(rec.extracted_text, _embed_model)
        except Exception as exc:
            logger.warning("Embedding failed for file %d: %s", rec.id, exc)
    pairs: List[SimilarPair] = []
    rec_by_id = {r.id: r for r in records}
    for (id_a, vec_a), (id_b, vec_b) in combinations(embed_map.items(), 2):
        rec_a = rec_by_id[id_a]
        rec_b = rec_by_id[id_b]
        if rec_a.filehash == rec_b.filehash:
            continue
        sim = cosine_similarity(vec_a, vec_b)
        if sim >= SIMILARITY_THRESH:
            older = rec_a if rec_a.created_date < rec_b.created_date else rec_b
            suggestion = f'Consider archiving the older version: "{older.filename}"'
            pairs.append(SimilarPair(
                file_a=rec_a, file_b=rec_b,
                similarity=round(sim, 4),
                suggestion=suggestion,
            ))
    pairs.sort(key=lambda p: p.similarity, reverse=True)
    return pairs


def _similar_image_pairs(conn) -> List[SimilarImagePair]:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM files
        WHERE status = 'active'
          AND image_phash IS NOT NULL AND image_phash != ''
        ORDER BY id
    """)
    rows = cursor.fetchall()
    records = [FileRecord(**dict(r)) for r in rows]
    if len(records) < 2:
        return []
    try:
        import imagehash
    except ImportError:
        return []
    pairs: List[SimilarImagePair] = []
    for rec_a, rec_b in combinations(records, 2):
        if rec_a.filehash == rec_b.filehash:
            continue
        try:
            hash_a = imagehash.hex_to_hash(rec_a.image_phash)
            hash_b = imagehash.hex_to_hash(rec_b.image_phash)
            dist = hash_a - hash_b
        except Exception:
            continue
        if dist <= PHASH_MAX_HAMMING:
            older = rec_a if rec_a.created_date < rec_b.created_date else rec_b
            suggestion = f'Possible near-duplicate image — consider keeping only one (older: "{older.filename}")'
            pairs.append(SimilarImagePair(
                file_a=rec_a, file_b=rec_b,
                hamming_distance=dist,
                suggestion=suggestion,
            ))
    pairs.sort(key=lambda p: p.hamming_distance)
    return pairs


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@app.post("/upload/scan", response_model=ScanResponse, tags=["Upload"])
async def upload_scan(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")
    conn = get_connection()
    inserted: List[FileRecord] = []
    try:
        cursor = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        for upload in files:
            original_name = upload.filename or "unknown"
            try:
                dest_path = os.path.join(UPLOAD_DIR, original_name)
                base, ext = os.path.splitext(original_name)
                counter = 1
                while os.path.exists(dest_path):
                    dest_path = os.path.join(UPLOAD_DIR, f"{base}_{counter}{ext}")
                    counter += 1
                content = await upload.read()
                if len(content) == 0:
                    logger.warning("Skipping empty file: %s", original_name)
                    continue
                with open(dest_path, "wb") as out:
                    out.write(content)
                file_size = os.path.getsize(dest_path)
                file_ext = os.path.splitext(original_name)[1].lstrip(".").lower() or "unknown"
                file_hash = _sha256(dest_path)
                text: Optional[str] = None
                try:
                    text = extract_text(dest_path, file_ext)
                except Exception as exc:
                    logger.warning("Text extraction error for %s: %s", original_name, exc)
                phash: Optional[str] = None
                if file_ext in IMAGE_TYPES:
                    try:
                        phash = compute_image_phash(dest_path)
                    except Exception as exc:
                        logger.warning("Phash error for %s: %s", original_name, exc)
                cursor.execute(
                    """
                    INSERT INTO files
                        (filename, filepath, filehash, filesize, filetype,
                         created_date, modified_date, status,
                         extracted_text, image_phash)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
                    """,
                    (original_name, dest_path, file_hash, file_size, file_ext,
                     now, now, text, phash),
                )
                conn.commit()
                cursor.execute("SELECT * FROM files WHERE id = ?", (cursor.lastrowid,))
                row = cursor.fetchone()
                inserted.append(FileRecord(**dict(row)))
            except Exception as exc:
                logger.warning("Failed to process file %s: %s", original_name, exc)
                continue
        duplicate_groups = _duplicate_groups(conn)
    finally:
        conn.close()
    return ScanResponse(
        uploaded=inserted,
        duplicate_groups=duplicate_groups,
        total_uploaded=len(inserted),
    )


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------

@app.get("/files/all", response_model=List[FileRecord], tags=["Files"])
async def get_all_files():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM files WHERE status = 'active' ORDER BY id DESC")
        return [FileRecord(**dict(r)) for r in cursor.fetchall()]
    finally:
        conn.close()


@app.get("/files/duplicates", response_model=List[DuplicateGroup], tags=["Files"])
async def get_duplicates():
    conn = get_connection()
    try:
        return _duplicate_groups(conn)
    finally:
        conn.close()


@app.get("/files/similar", response_model=List[SimilarPair], tags=["Files"])
async def get_similar():
    conn = get_connection()
    try:
        dup_groups = _duplicate_groups(conn)
        exact_hashes = {g.filehash for g in dup_groups}
        return _similar_text_pairs(conn, exact_hashes)
    finally:
        conn.close()


@app.get("/files/similar-images", response_model=List[SimilarImagePair], tags=["Files"])
async def get_similar_images():
    conn = get_connection()
    try:
        return _similar_image_pairs(conn)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

@app.post("/files/score-all", response_model=ScoreAllResponse, tags=["Scoring"])
async def score_all_files():
    global _embed_cache
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM files WHERE status IN ('active', 'pending_delete') ORDER BY id")
        rows = cursor.fetchall()
        if not rows:
            return ScoreAllResponse(scored_count=0, message="No files found to score.")
        records = [FileRecord(**dict(r)) for r in rows]

        # Build duplicate count map: filehash -> count
        hash_counts: dict[str, int] = {}
        for rec in records:
            hash_counts[rec.filehash] = hash_counts.get(rec.filehash, 0) + 1

        # Build similarity sets (file IDs involved in any similar pair)
        similar_ids: set[int] = set()
        if _embed_model is not None:
            try:
                dup_groups = _duplicate_groups(conn)
                exact_hashes = {g.filehash for g in dup_groups}
                sim_pairs = _similar_text_pairs(conn, exact_hashes)
                for p in sim_pairs:
                    similar_ids.add(p.file_a.id)
                    similar_ids.add(p.file_b.id)
                img_pairs = _similar_image_pairs(conn)
                for p in img_pairs:
                    similar_ids.add(p.file_a.id)
                    similar_ids.add(p.file_b.id)
            except Exception as exc:
                logger.warning("Could not compute similarity for scoring: %s", exc)

        scored_count = 0
        new_cache: dict[int, list[float]] = {}
        for rec in records:
            try:
                dup_count = hash_counts.get(rec.filehash, 1)
                has_similar = rec.id in similar_ids
                score = calculate_value_score(rec, dup_count, has_similar)
                days = calculate_days_since_modified(rec.modified_date)
                recommendation = generate_recommendation(score, dup_count, has_similar, days)
                cursor.execute(
                    "UPDATE files SET value_score = ?, recommendation = ? WHERE id = ?",
                    (score, recommendation, rec.id),
                )
                scored_count += 1
                # Build embedding for search cache
                if _embed_model is not None:
                    try:
                        text_for_embed = (rec.filename + " " + (rec.extracted_text or "")[:200]).strip()
                        vec = get_embedding(text_for_embed, _embed_model)
                        new_cache[rec.id] = vec
                    except Exception as exc:
                        logger.warning("Embed cache failed for file %d: %s", rec.id, exc)
            except Exception as exc:
                logger.warning("Scoring failed for file %d: %s", rec.id, exc)

        conn.commit()
        _embed_cache = new_cache
        return ScoreAllResponse(
            scored_count=scored_count,
            message=f"Scored {scored_count} files successfully.",
        )
    finally:
        conn.close()


@app.get("/files/scored", response_model=List[FileRecord], tags=["Scoring"])
async def get_scored_files():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM files
            WHERE status IN ('active', 'pending_delete')
            ORDER BY
                CASE WHEN value_score IS NULL THEN 1 ELSE 0 END,
                value_score ASC
        """)
        return [FileRecord(**dict(r)) for r in cursor.fetchall()]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

@app.post("/files/simulate-delete", response_model=SimulateDeleteResponse, tags=["Cleanup"])
async def simulate_delete(request: SimulateDeleteRequest):
    if not request.file_ids:
        raise HTTPException(status_code=400, detail="No file IDs provided.")
    conn = get_connection()
    try:
        cursor = conn.cursor()
        placeholders = ",".join("?" * len(request.file_ids))
        cursor.execute(
            f"SELECT id, filesize FROM files WHERE id IN ({placeholders}) AND status = 'active'",
            tuple(request.file_ids),
        )
        rows = cursor.fetchall()
        total_bytes = sum(r["filesize"] for r in rows)
        actual_ids = [r["id"] for r in rows]
        if actual_ids:
            cursor.execute(
                f"UPDATE files SET status = 'pending_delete' WHERE id IN ({','.join('?' * len(actual_ids))})",
                tuple(actual_ids),
            )
            conn.commit()
        return SimulateDeleteResponse(
            marked_count=len(actual_ids),
            recoverable_bytes=total_bytes,
            recoverable_mb=round(total_bytes / (1024 * 1024), 2),
        )
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@app.get("/files/stats", response_model=StatsResponse, tags=["Stats"])
async def get_stats():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*), COALESCE(SUM(filesize), 0) FROM files WHERE status IN ('active', 'pending_delete')"
        )
        row = cursor.fetchone()
        total_files = row[0]
        total_storage_bytes = row[1]

        # Duplicate wasted storage
        cursor.execute("""
            SELECT filehash, COUNT(*) as cnt, MIN(filesize) as fsize
            FROM files WHERE status = 'active'
            GROUP BY filehash HAVING cnt > 1
        """)
        dup_rows = cursor.fetchall()
        dup_storage_bytes = sum(r["fsize"] * (r["cnt"] - 1) for r in dup_rows)

        # Safe to delete
        cursor.execute(
            "SELECT COUNT(*), COALESCE(SUM(filesize), 0) FROM files WHERE recommendation LIKE 'Safe to delete%' AND status = 'active'"
        )
        safe_row = cursor.fetchone()
        safe_count = safe_row[0]
        recoverable_bytes = safe_row[1]

        return StatsResponse(
            total_files=total_files,
            total_storage_bytes=total_storage_bytes,
            total_storage_mb=round(total_storage_bytes / (1024 * 1024), 2),
            duplicate_storage_bytes=dup_storage_bytes,
            duplicate_storage_mb=round(dup_storage_bytes / (1024 * 1024), 2),
            safe_to_delete_count=safe_count,
            recoverable_bytes=recoverable_bytes,
            recoverable_mb=round(recoverable_bytes / (1024 * 1024), 2),
        )
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@app.get("/files/search", response_model=List[SearchResult], tags=["Search"])
async def search_files(q: str = Query(..., min_length=1)):
    if _embed_model is None:
        raise HTTPException(status_code=503, detail="Embedding model not available.")
    query_text = q.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    query_vec = get_embedding(query_text, _embed_model)
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM files WHERE status IN ('active', 'pending_delete') ORDER BY id"
        )
        rows = cursor.fetchall()
        records = [FileRecord(**dict(r)) for r in rows]
    finally:
        conn.close()
    if not records:
        return []
    results = []
    for rec in records:
        try:
            if rec.id in _embed_cache:
                file_vec = _embed_cache[rec.id]
            else:
                text_for_embed = (rec.filename + " " + (rec.extracted_text or "")[:200]).strip()
                file_vec = get_embedding(text_for_embed, _embed_model)
                _embed_cache[rec.id] = file_vec
            sim = cosine_similarity(query_vec, file_vec)
            results.append(SearchResult(file=rec, similarity_score=round(sim, 4)))
        except Exception as exc:
            logger.warning("Search failed for file %d: %s", rec.id, exc)
    results.sort(key=lambda r: r.similarity_score, reverse=True)
    return results[:5]
