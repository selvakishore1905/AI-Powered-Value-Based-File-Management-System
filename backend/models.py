from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class FileBase(BaseModel):
    filename: str
    filepath: str
    filehash: str
    filesize: int
    filetype: str


class FileRecord(FileBase):
    id: int
    created_date: str
    modified_date: str
    value_score:    Optional[float] = None
    recommendation: Optional[str]  = None
    status:         str
    extracted_text: Optional[str]  = None
    image_phash:    Optional[str]  = None
    model_config = {"from_attributes": True}


class DuplicateGroup(BaseModel):
    filehash: str
    files: List[FileRecord]
    count: int
    wasted_bytes: int


class ScanResponse(BaseModel):
    uploaded:         List[FileRecord]
    duplicate_groups: List[DuplicateGroup]
    total_uploaded:   int


class SimilarPair(BaseModel):
    file_a: FileRecord
    file_b: FileRecord
    similarity: float
    suggestion: str


class SimilarImagePair(BaseModel):
    file_a: FileRecord
    file_b: FileRecord
    hamming_distance: int
    suggestion: str


class HealthResponse(BaseModel):
    status: str


class ScoreAllResponse(BaseModel):
    scored_count: int
    message: str


class SimulateDeleteRequest(BaseModel):
    file_ids: List[int]


class SimulateDeleteResponse(BaseModel):
    marked_count: int
    recoverable_bytes: int
    recoverable_mb: float


class StatsResponse(BaseModel):
    total_files: int
    total_storage_bytes: int
    total_storage_mb: float
    duplicate_storage_bytes: int
    duplicate_storage_mb: float
    safe_to_delete_count: int
    recoverable_bytes: int
    recoverable_mb: float


class SearchResult(BaseModel):
    file: FileRecord
    similarity_score: float
