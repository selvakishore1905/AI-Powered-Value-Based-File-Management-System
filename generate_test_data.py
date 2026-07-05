"""
generate_test_data.py
─────────────────────
Generates a realistic test-data folder at ./test_data/ with:
  - 4 copies of the same resume PDF under different names
  - 2 versions of a project report DOCX (version 2 has minor content changes)
  - 5 screenshot-like PNG files with random small image content
  - 1 old installer placeholder (OldSetup.exe) with modified_date set to 3 years ago
  - 2 important files (Passport.pdf, Certificate.pdf) with realistic placeholder text

Run from the project root:
    python generate_test_data.py
"""

import os
import random
import struct
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "test_data"
OUTPUT_DIR.mkdir(exist_ok=True)

# ── Helpers ──────────────────────────────────────────────────────────────────

def write_text_file(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    print(f"  Created: {path.name}")


def set_file_times(path: Path, dt: datetime) -> None:
    """Set both atime and mtime of a file to the given datetime."""
    ts = dt.timestamp()
    os.utime(str(path), (ts, ts))


def make_minimal_pdf(content_lines: list[str]) -> bytes:
    """
    Build a *minimal but valid* single-page PDF containing the given text lines.
    This avoids needing reportlab/fpdf and produces a file PyMuPDF can open.
    """
    text_block = "\\n".join(content_lines)
    # Encode content stream
    stream_content = (
        "BT\n"
        "/F1 12 Tf\n"
        "72 720 Td\n"
        f"({text_block}) Tj\n"
        "ET\n"
    ).encode()

    xref_positions: list[int] = []

    def obj(number: int, payload: str) -> bytes:
        return f"{number} 0 obj\n{payload}\nendobj\n".encode()

    catalog   = obj(1, "<< /Type /Catalog /Pages 2 0 R >>")
    pages     = obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    page      = obj(3, (
        "<< /Type /Page /Parent 2 0 R "
        "/MediaBox [0 0 612 792] "
        "/Contents 4 0 R "
        "/Resources << /Font << /F1 5 0 R >> >> >>"
    ))
    stream    = (
        f"4 0 obj\n<< /Length {len(stream_content)} >>\nstream\n".encode()
        + stream_content
        + b"\nendstream\nendobj\n"
    )
    font      = obj(5, (
        "<< /Type /Font /Subtype /Type1 "
        "/BaseFont /Helvetica "
        "/Encoding /WinAnsiEncoding >>"
    ))

    header = b"%PDF-1.4\n"
    body   = b""
    objects = [catalog, pages, page, stream, font]
    offsets: list[int] = []
    pos = len(header)
    for o in objects:
        offsets.append(pos)
        body += o
        pos  += len(o)

    xref_offset = len(header) + len(body)
    xref = f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    for off in offsets:
        xref += f"{off:010d} 00000 n \n"
    trailer = (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
    )

    return header + body + xref.encode() + trailer.encode()


def make_minimal_docx(paragraphs: list[str]) -> bytes:
    """
    Build a minimal .docx file (ZIP containing word/document.xml).
    Avoids needing python-docx for generation.
    """
    import io
    import zipfile

    para_xml = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{p}</w:t></w:r></w:p>'
        for p in paragraphs
    )
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" '
        'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n'
        '<w:body>\n'
        f'{para_xml}\n'
        '</w:body>\n'
        '</w:document>'
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '</Types>'
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/>'
        '</Relationships>'
    )
    word_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '</Relationships>'
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document_xml)
        zf.writestr("word/_rels/document.xml.rels", word_rels)
    return buf.getvalue()


def make_minimal_png(width: int = 64, height: int = 64) -> bytes:
    """Generate a tiny valid PNG with random pixel data (no PIL needed)."""
    import zlib

    def write_chunk(chunk_type: bytes, data: bytes) -> bytes:
        chunk = chunk_type + data
        return (
            struct.pack(">I", len(data))
            + chunk
            + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)
        )

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr      = write_chunk(b"IHDR", ihdr_data)

    # Build raw pixel rows (filter byte 0x00 + RGB pixels)
    raw_rows = b""
    for _ in range(height):
        raw_rows += b"\x00"  # filter byte: None
        for _ in range(width):
            raw_rows += bytes([random.randint(0, 255) for _ in range(3)])

    idat = write_chunk(b"IDAT", zlib.compress(raw_rows, 9))
    iend = write_chunk(b"IEND", b"")

    return signature + ihdr + idat + iend


# ── Resume PDFs (4 copies, same content, different names) ─────────────────────

RESUME_CONTENT = [
    "CURRICULUM VITAE",
    "Name: Alex Morgan",
    "Email: alex.morgan@email.com | Phone: +1 (555) 234-5678",
    "LinkedIn: linkedin.com/in/alexmorgan | GitHub: github.com/alexmorgan",
    "",
    "PROFESSIONAL SUMMARY",
    "Experienced software engineer with 6+ years in full-stack development,",
    "specializing in Python, React, and cloud infrastructure. Proven track record",
    "of delivering scalable systems and leading cross-functional teams.",
    "",
    "EXPERIENCE",
    "Senior Software Engineer | TechCorp Inc. | 2021 - Present",
    "  - Led migration of monolithic application to microservices (reduced latency 40%)",
    "  - Architected real-time data pipeline handling 2M events/day",
    "  - Mentored team of 4 junior engineers",
    "",
    "Software Engineer | DataSoft LLC | 2018 - 2021",
    "  - Built REST APIs serving 500K daily active users",
    "  - Implemented automated testing (coverage 87%)",
    "",
    "EDUCATION",
    "B.Sc. Computer Science | State University | 2018",
    "",
    "SKILLS",
    "Python, JavaScript, TypeScript, React, FastAPI, PostgreSQL, Docker, Kubernetes, AWS",
]

resume_names = ["Resume.pdf", "Resume (1).pdf", "Resume_Final.pdf", "Resume_Copy.pdf"]
resume_bytes = make_minimal_pdf(RESUME_CONTENT)

print("\n[1] Creating resume PDFs (4 copies)...")
for name in resume_names:
    path = OUTPUT_DIR / name
    path.write_bytes(resume_bytes)
    print(f"  Created: {name}")

# ── Project Report DOCX (2 versions) ─────────────────────────────────────────

REPORT_V1_PARAS = [
    "Project Report: StorageIQ Platform",
    "Version 1.0 | Date: January 2024",
    "",
    "Executive Summary",
    "StorageIQ is a file deduplication and management platform designed to help",
    "organizations reduce storage costs by identifying and removing redundant files.",
    "The system employs SHA-256 hashing for exact duplicate detection and",
    "sentence-transformer embeddings for near-duplicate text comparison.",
    "",
    "Technical Architecture",
    "The backend is built with FastAPI and SQLite, providing a lightweight but",
    "scalable foundation. The frontend is implemented in React with Tailwind CSS.",
    "",
    "Results",
    "In initial testing with 500 files, the system identified 34% as duplicates,",
    "recovering an estimated 12 GB of storage space.",
    "",
    "Conclusion",
    "StorageIQ demonstrates strong potential for enterprise deployment.",
    "Next steps include cloud storage API integration and video deduplication.",
]

REPORT_V2_PARAS = [
    "Project Report: StorageIQ Platform",
    "Version 2.0 | Date: March 2024",
    "",
    "Executive Summary",
    "StorageIQ is an intelligent file deduplication and management platform that helps",
    "organizations dramatically reduce storage costs by identifying redundant files.",
    "The system now employs SHA-256 hashing, perceptual image hashing, and",
    "sentence-transformer embeddings for comprehensive duplicate detection.",
    "",
    "Technical Architecture",
    "The backend is built with FastAPI and SQLite, providing a lightweight but",
    "scalable foundation. The frontend uses React with Tailwind CSS and includes",
    "a natural language search interface powered by the same embedding model.",
    "",
    "Results",
    "In extended testing with 1,200 files, the system identified 41% as duplicates,",
    "recovering an estimated 28 GB of storage space.",
    "",
    "New Features in v2.0",
    "- Perceptual image hash comparison for near-duplicate image detection",
    "- Natural language file search with semantic similarity ranking",
    "- File Value Score system for intelligent cleanup recommendations",
    "",
    "Conclusion",
    "StorageIQ v2.0 is production-ready for enterprise deployment.",
    "Planned features: cloud storage APIs, video deduplication, auto-organization.",
]

print("\n[2] Creating project report DOCX files (2 versions)...")
for fname, paras in [("ProjectReport_v1.docx", REPORT_V1_PARAS), ("ProjectReport_v2.docx", REPORT_V2_PARAS)]:
    path = OUTPUT_DIR / fname
    path.write_bytes(make_minimal_docx(paras))
    print(f"  Created: {fname}")

# ── Screenshot PNGs (5 files) ─────────────────────────────────────────────────

print("\n[3] Creating screenshot PNG files (5 files)...")
screenshot_dates = [
    datetime(2023, 3, 15, 10, 22, 0, tzinfo=timezone.utc),
    datetime(2023, 6, 8,  14, 5,  0, tzinfo=timezone.utc),
    datetime(2023, 9, 21, 9,  47, 0, tzinfo=timezone.utc),
    datetime(2024, 1, 3,  16, 30, 0, tzinfo=timezone.utc),
    datetime(2024, 4, 19, 11, 0,  0, tzinfo=timezone.utc),
]
for i, dt in enumerate(screenshot_dates):
    stamp = dt.strftime("%Y%m%d_%H%M%S")
    fname = f"Screenshot_{stamp}.png"
    path  = OUTPUT_DIR / fname
    # Slightly different sizes so they aren't exact duplicates
    path.write_bytes(make_minimal_png(width=64 + i * 4, height=64 + i * 4))
    set_file_times(path, dt)
    print(f"  Created: {fname}")

# ── Old installer placeholder ─────────────────────────────────────────────────

print("\n[4] Creating old installer placeholder (OldSetup.exe)...")
installer_path = OUTPUT_DIR / "OldSetup.exe"
installer_path.write_bytes(b"MZ\x00\x00" + b"\x00" * 60)  # Minimal PE-like header placeholder
three_years_ago = datetime.now(timezone.utc) - timedelta(days=3 * 365)
set_file_times(installer_path, three_years_ago)
print(f"  Created: OldSetup.exe (modified_date set to {three_years_ago.date()})")

# ── Important documents ───────────────────────────────────────────────────────

print("\n[5] Creating important documents (Passport.pdf, Certificate.pdf)...")

PASSPORT_CONTENT = [
    "PASSPORT - OFFICIAL DOCUMENT",
    "",
    "SURNAME: MORGAN",
    "GIVEN NAMES: ALEX JAMES",
    "NATIONALITY: UNITED STATES OF AMERICA",
    "DATE OF BIRTH: 15 MAR 1995",
    "PLACE OF BIRTH: NEW YORK, USA",
    "DATE OF ISSUE: 20 JAN 2020",
    "DATE OF EXPIRY: 19 JAN 2030",
    "PASSPORT NO: A12345678",
    "",
    "This passport is the property of the issuing government.",
    "If found, please return to the nearest embassy or consulate.",
]

CERTIFICATE_CONTENT = [
    "CERTIFICATE OF ACHIEVEMENT",
    "",
    "This is to certify that",
    "",
    "ALEX MORGAN",
    "",
    "has successfully completed the requirements for",
    "",
    "AWS Certified Solutions Architect - Professional",
    "",
    "Issued by: Amazon Web Services",
    "Certificate ID: AWS-PSA-2023-789456",
    "Issue Date: September 15, 2023",
    "Valid Through: September 15, 2026",
    "",
    "This certificate validates expertise in designing distributed systems",
    "on the AWS platform, including high availability architectures,",
    "security best practices, and cost optimization strategies.",
]

for fname, content in [("Passport.pdf", PASSPORT_CONTENT), ("Certificate.pdf", CERTIFICATE_CONTENT)]:
    path = OUTPUT_DIR / fname
    path.write_bytes(make_minimal_pdf(content))
    print(f"  Created: {fname}")

# ── Summary ───────────────────────────────────────────────────────────────────

print(f"\n{'=' * 60}")
print(f"Test data generated in: {OUTPUT_DIR.resolve()}")
files = sorted(OUTPUT_DIR.iterdir())
total_size = sum(f.stat().st_size for f in files if f.is_file())
print(f"Total files: {len(files)}")
print(f"Total size:  {total_size / 1024:.1f} KB")
print(f"{'=' * 60}")
print("\nFiles created:")
for f in files:
    if f.is_file():
        size = f.stat().st_size
        mtime = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d")
        print(f"  {f.name:<40} {size:>8} bytes  (modified: {mtime})")
print("\nDone! Upload the test_data/ folder to StorageIQ to run the demo.")
