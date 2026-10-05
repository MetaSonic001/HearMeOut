from app.config import Settings
from app.storage.base import AudioStorage, StorageError
from app.storage.local import LocalStorage
from app.storage.supabase import SupabaseStorage

__all__ = ["AudioStorage", "StorageError", "LocalStorage", "SupabaseStorage", "build_storage"]


def build_storage(settings: Settings) -> AudioStorage:
    if settings.storage_backend == "supabase":
        if not settings.supabase_url or not settings.supabase_secret_key:
            raise RuntimeError("STORAGE_BACKEND=supabase requires SUPABASE_URL and SUPABASE_SECRET_KEY")
        return SupabaseStorage(settings.supabase_url, settings.supabase_secret_key, settings.supabase_bucket)
    return LocalStorage(settings.local_audio_dir)
