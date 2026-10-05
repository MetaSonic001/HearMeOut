"""Request bodies (Pydantic v2). Response shapes are built by the services as plain dicts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

Mode = Literal["read", "translate", "study", "revision", "explain", "quiz"]


class DraftFromText(BaseModel):
    text: str = Field(min_length=1, max_length=8_000_000)
    title: str | None = Field(default=None, max_length=140)


class DraftFromUrl(BaseModel):
    url: HttpUrl


class SectionUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    text: str | None = Field(default=None, max_length=2_000_000)


class CreateDocument(BaseModel):
    draft_id: str = Field(min_length=6, max_length=64)
    mode: Mode = "read"
    language: str | None = Field(default=None, max_length=12)
    voice: str | None = Field(default=None, max_length=64)
    voice2: str | None = Field(default=None, max_length=64)
    sections: list[int] | None = Field(default=None, max_length=5000)
    title: str | None = Field(default=None, max_length=140)


class RenameDocument(BaseModel):
    title: str = Field(min_length=1, max_length=140)


class Progress(BaseModel):
    chunk: int = Field(ge=0)
    offset: float = Field(default=0, ge=0, le=36000)


class CheckoutRequest(BaseModel):
    product: Literal["pro_monthly", "pro_yearly", "book"]
    doc_id: str | None = Field(default=None, max_length=64)
    return_path: str | None = Field(default=None, max_length=200)


class EventIn(BaseModel):
    name: str = Field(min_length=1, max_length=48, pattern=r"^[a-z0-9_]+$")
    path: str | None = Field(default=None, max_length=300)
    referrer: str | None = Field(default=None, max_length=300)
    anon_id: str | None = Field(default=None, max_length=40)
    meta: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
