from pathlib import Path
from uuid import UUID

from app.config import settings


class FileStorageService:
    """Shared file storage for uploaded source documents."""

    def __init__(self) -> None:
        self.base_path = Path(settings.UPLOAD_STORAGE_PATH)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def save_upload(
        self,
        *,
        org_id: UUID,
        session_id: UUID,
        file_ext: str,
        content: bytes,
    ) -> str:
        org_dir = self.base_path / str(org_id)
        org_dir.mkdir(parents=True, exist_ok=True)
        sanitized_ext = file_ext.lower().lstrip(".") or "bin"
        file_path = org_dir / f"{session_id}.{sanitized_ext}"
        file_path.write_bytes(content)
        return str(file_path)

    def read_upload(self, stored_file_path: str) -> bytes:
        return Path(stored_file_path).read_bytes()

    def exists(self, stored_file_path: str | None) -> bool:
        if not stored_file_path:
            return False
        return Path(stored_file_path).exists()


file_storage_service = FileStorageService()
