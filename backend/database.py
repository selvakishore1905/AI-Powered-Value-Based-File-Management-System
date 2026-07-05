import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "storageiq.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id              INTEGER  PRIMARY KEY AUTOINCREMENT,
                filename        TEXT     NOT NULL,
                filepath        TEXT     NOT NULL,
                filehash        TEXT     NOT NULL,
                filesize        INTEGER  NOT NULL,
                filetype        TEXT     NOT NULL,
                created_date    DATETIME DEFAULT CURRENT_TIMESTAMP,
                modified_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
                value_score     REAL,
                recommendation  TEXT,
                status          TEXT     DEFAULT 'active',
                extracted_text  TEXT,
                image_phash     TEXT
            )
        """)
        existing = {row[1] for row in cursor.execute("PRAGMA table_info(files)").fetchall()}
        for col, definition in [
            ("extracted_text", "TEXT"),
            ("image_phash",    "TEXT"),
            ("value_score",    "REAL"),
            ("recommendation", "TEXT"),
        ]:
            if col not in existing:
                cursor.execute(f"ALTER TABLE files ADD COLUMN {col} {definition}")
        conn.commit()
        print("[DB] Schema initialised successfully.")
    finally:
        conn.close()
