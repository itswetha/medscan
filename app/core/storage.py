from pathlib import Path

from app.core.config import settings


class UnsafeStoragePath(ValueError):
    pass


def resolve_upload_file(stored_path: str) -> Path:
    """Resolve a stored path and ensure it remains inside UPLOAD_DIR."""
    upload_root = Path(settings.upload_dir).resolve()
    candidate = Path(stored_path)
    if not candidate.is_absolute():
        candidate = Path.cwd() / candidate
    resolved = candidate.resolve()
    try:
        resolved.relative_to(upload_root)
    except ValueError as exc:
        raise UnsafeStoragePath("Stored file path is outside the upload directory") from exc
    return resolved
