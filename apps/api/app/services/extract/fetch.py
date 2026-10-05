"""Fetch a web page or PDF by URL, safely (SSRF-guarded, size- and time-limited)."""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import httpx

from app.services.extract.types import ExtractionError

MAX_BYTES = 12 * 1024 * 1024
MAX_REDIRECTS = 4
ALLOWED_PORTS = {None, 80, 443, 8080, 8443}
USER_AGENT = "HearMeOutBot/1.0 (reads pages on behalf of the user)"
ACCEPTED_TYPES = ("text/html", "application/xhtml+xml", "text/plain", "application/pdf")


def _is_public(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


async def assert_public_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ExtractionError("bad_url", "Enter a full web address starting with http:// or https://")
    if parsed.port not in ALLOWED_PORTS:
        raise ExtractionError("bad_url", "That web address uses a port we cannot open.")
    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ExtractionError("unreachable", "We could not find that website. Check the address.") from exc
    if not infos or not all(_is_public(info[4][0]) for info in infos):
        raise ExtractionError("bad_url", "That address is not a public website.")


async def fetch_url(url: str, *, client: httpx.AsyncClient | None = None) -> tuple[bytes, str, str]:
    """Return (body, content_type, final_url). Raises ExtractionError on any problem."""
    owns_client = client is None
    client = client or httpx.AsyncClient(
        timeout=httpx.Timeout(15.0, connect=8.0),
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/pdf,text/plain;q=0.9"},
        follow_redirects=False,
    )
    try:
        current = url.strip()
        for _ in range(MAX_REDIRECTS + 1):
            await assert_public_url(current)
            try:
                async with client.stream("GET", current) as resp:
                    if resp.status_code in {301, 302, 303, 307, 308}:
                        location = resp.headers.get("location")
                        if not location:
                            raise ExtractionError("unreachable", "The website redirected us nowhere.")
                        current = urljoin(current, location)
                        continue
                    if resp.status_code >= 400:
                        raise ExtractionError(
                            "unreachable", f"The website refused our request (error {resp.status_code})."
                        )
                    ctype = resp.headers.get("content-type", "").split(";")[0].strip().lower()
                    if ctype and not ctype.startswith(ACCEPTED_TYPES):
                        raise ExtractionError("unsupported", "That link is not a web page or PDF.")
                    declared = int(resp.headers.get("content-length", "0") or 0)
                    if declared > MAX_BYTES:
                        raise ExtractionError("too_large", "That page is too large to read.")
                    body = bytearray()
                    async for part in resp.aiter_bytes():
                        body.extend(part)
                        if len(body) > MAX_BYTES:
                            raise ExtractionError("too_large", "That page is too large to read.")
                    return bytes(body), ctype or "text/html", current
            except httpx.TimeoutException as exc:
                raise ExtractionError("unreachable", "The website took too long to respond.") from exc
            except httpx.HTTPError as exc:
                raise ExtractionError("unreachable", "We could not open that website.") from exc
        raise ExtractionError("unreachable", "The website redirected too many times.")
    finally:
        if owns_client:
            await client.aclose()
