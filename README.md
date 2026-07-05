# StorageIQ

**StorageIQ** is an AI-powered file management and deduplication tool. Upload a folder of files, and it automatically detects exact duplicates, near-duplicate documents, similar images, scores every file by value, and gives cleanup recommendations — all in a single local dashboard.

---

## What It Does

| Feature | How it works |
|---|---|
| **Exact duplicate detection** | SHA-256 hashing — byte-identical files grouped and flagged |
| **Near-duplicate documents** | `all-MiniLM-L6-v2` sentence-transformer embeddings + cosine similarity (≥ 85%) |
| **Similar image detection** | Perceptual hashing (pHash) with Hamming-distance threshold |
| **File Value Scoring** | Weighted formula (duplicate count, age, filename patterns, file type) → score 0–100 |
| **Cleanup recommendations** | "Safe to delete" / "Archive" / "Keep" with a plain-English reason |
| **Cleanup simulation** | Select files → mark as `pending_delete`, see recoverable space — nothing deleted from disk |
| **Natural language search** | Type "find my resume" → semantic search over filenames + extracted text using the same embedding model |
| **Text extraction** | PDF (PyMuPDF), DOCX (python-docx), TXT |

---

## How to Run Locally

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The server starts at `http://localhost:8000`.  
API docs available at `http://localhost:8000/docs`.

The sentence-transformer model (`all-MiniLM-L6-v2`) is downloaded automatically on first run (~90 MB).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app opens at `http://localhost:5173`.

### Generate Test Data

```bash
python generate_test_data.py
```

This creates a `test_data/` folder with realistic demo files (resume copies, report versions, screenshots, an old installer, and important documents). Upload the contents via the StorageIQ Upload page.

---

## Demo Flow

1. Open `http://localhost:5173` → **Upload** tab
2. Drag & drop all files from `test_data/` and click **Scan for Duplicates**
3. You'll be redirected to the **Dashboard** — duplicates and similar files appear immediately
4. Click **Score All Files** — each file gets a Value Score (0–100) and recommendation
5. Use filter buttons (**Safe to delete**, **Archive**, **Keep**) to review low-value files
6. Check files you want to remove, click **Clean Up Selected** — space recovered is shown
7. Use the search bar to try: `"find my resume"`, `"college certificate"`, `"old screenshots"`

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Liveness probe |
| POST | `/upload/scan` | Upload files, detect duplicates |
| GET | `/files/all` | All active files |
| GET | `/files/duplicates` | Exact duplicate groups |
| GET | `/files/similar` | Near-duplicate document pairs |
| GET | `/files/similar-images` | Near-duplicate image pairs |
| POST | `/files/score-all` | Score every file, populate `value_score` + `recommendation` |
| GET | `/files/scored` | All files sorted by score ascending |
| POST | `/files/simulate-delete` | Mark files as `pending_delete`, return recoverable bytes |
| GET | `/files/stats` | Aggregate stats (total storage, duplicates, recoverable space) |
| GET | `/files/search?q=...` | Semantic search, returns top 5 matches |

---

## What's in This Prototype

- ✅ File upload with drag-and-drop
- ✅ Exact duplicate detection (SHA-256)
- ✅ Near-duplicate text detection (sentence-transformers)
- ✅ Near-duplicate image detection (pHash)
- ✅ File Value Scoring (weighted heuristic formula)
- ✅ Cleanup recommendations (Safe to delete / Archive / Keep)
- ✅ Cleanup simulation (no real file deletion)
- ✅ Natural language file search (semantic embeddings)
- ✅ Dashboard with sortable/filterable table
- ✅ Stats cards (total storage, duplicates, recoverable space)
- ✅ Sticky selection bar with batch cleanup

---

## Intentionally Out of Scope

The following features are **not included in this 24-hour prototype** and would require significant additional engineering:

| Out of Scope | Reason |
|---|---|
| **Real cloud storage API integration** (S3, GDrive, OneDrive) | OAuth flows, API rate limits, streaming uploads |
| **Video deduplication** | Requires frame-level perceptual hashing (very slow, model-heavy) |
| **Deep learning image similarity** | CNN-based embeddings (e.g. CLIP) require GPU and >10× more compute |
| **Automatic folder reorganization** | File moves require OS-level permissions and conflict resolution |
| **Real file deletion** | Simulate-delete is intentionally safe; real deletion is a separate, auditable action |
| **Authentication / multi-user** | Single-user local tool only |
| **Incremental scanning** | Currently re-scans all uploads; no filesystem watcher |

---

## Project Structure

```
fileManager/
├── backend/
│   ├── main.py            # FastAPI app, all endpoints
│   ├── models.py          # Pydantic response models
│   ├── processing.py      # Text extraction, embeddings, scoring
│   ├── database.py        # SQLite init + migrations
│   ├── requirements.txt
│   └── uploaded_files/    # Saved uploads (created at runtime)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   └── UploadPage.jsx
│   │   └── index.css
│   └── package.json
├── generate_test_data.py  # Demo data generator
└── README.md
```
