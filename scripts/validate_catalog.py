#!/usr/bin/env python3
"""Validate the catalog without third-party dependencies."""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "catalog.json"
SCHEMA_PATH = ROOT / "catalog.schema.json"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]+$")
SECRET_KEYS = {"api_key", "apikey", "access_token", "token", "app_id", "appid", "client_secret"}


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_string(value: object, path: str) -> None:
    if not isinstance(value, str) or not value.strip():
        fail(f"{path} must be a non-empty string")


def require_url(value: object, path: str) -> None:
    require_string(value, path)
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        fail(f"{path} must be an absolute HTTP(S) URL")
    query_keys = {key.lower() for key in parse_qs(parsed.query)}
    leaked = sorted(query_keys & SECRET_KEYS)
    if leaked:
        fail(f"{path} contains secret-like query parameter(s): {', '.join(leaked)}")


def require_date(value: object, path: str) -> None:
    require_string(value, path)
    if not DATE_RE.fullmatch(value):
        fail(f"{path} must use YYYY-MM-DD")
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        fail(f"{path} is not a valid date: {exc}")


def require_string_list(value: object, path: str) -> None:
    if not isinstance(value, list) or not value:
        fail(f"{path} must be a non-empty list")
    for index, item in enumerate(value):
        require_string(item, f"{path}[{index}]")


def validate() -> None:
    try:
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(str(exc))

    if not isinstance(schema, dict) or schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        fail("catalog.schema.json must declare JSON Schema draft 2020-12")
    if not isinstance(catalog, dict):
        fail("catalog.json root must be an object")

    for key in ("$schema", "catalog_version", "last_updated", "entries"):
        if key not in catalog:
            fail(f"catalog.json is missing {key}")
    require_url(catalog["$schema"], "catalog.$schema")
    require_string(catalog["catalog_version"], "catalog.catalog_version")
    require_date(catalog["last_updated"], "catalog.last_updated")
    if not isinstance(catalog["entries"], list) or not catalog["entries"]:
        fail("catalog.entries must be a non-empty list")

    ids: set[str] = set()
    for index, entry in enumerate(catalog["entries"]):
        path = f"entries[{index}]"
        if not isinstance(entry, dict):
            fail(f"{path} must be an object")
        for key in (
            "id",
            "title",
            "publisher",
            "type",
            "domains",
            "geography",
            "languages",
            "temporal_coverage",
            "access",
            "license",
            "ai_summary",
            "query_hints",
            "caveats",
            "status",
            "last_verified",
            "source_urls",
        ):
            if key not in entry:
                fail(f"{path} is missing {key}")

        entry_id = entry["id"]
        require_string(entry_id, f"{path}.id")
        if not ID_RE.fullmatch(entry_id):
            fail(f"{path}.id must contain only lowercase letters, digits, and hyphens")
        if entry_id in ids:
            fail(f"duplicate entry id: {entry_id}")
        ids.add(entry_id)

        for key in ("title", "publisher", "ai_summary", "status"):
            require_string(entry[key], f"{path}.{key}")
        for key in ("domains", "geography", "languages", "query_hints", "caveats"):
            require_string_list(entry[key], f"{path}.{key}")
        require_date(entry["last_verified"], f"{path}.last_verified")

        coverage = entry["temporal_coverage"]
        if not isinstance(coverage, dict):
            fail(f"{path}.temporal_coverage must be an object")
        for key in ("start", "end", "granularity"):
            require_string(coverage.get(key), f"{path}.temporal_coverage.{key}")

        access = entry["access"]
        if not isinstance(access, dict):
            fail(f"{path}.access must be an object")
        for key in ("mode", "auth", "formats", "rate_limit_notes"):
            if key not in access:
                fail(f"{path}.access is missing {key}")
        require_url(access.get("base_url"), f"{path}.access.base_url")
        require_url(access.get("docs_url"), f"{path}.access.docs_url")
        require_string(access["mode"], f"{path}.access.mode")
        require_string(access["auth"], f"{path}.access.auth")
        require_string_list(access["formats"], f"{path}.access.formats")
        require_string(access["rate_limit_notes"], f"{path}.access.rate_limit_notes")

        license_info = entry["license"]
        if not isinstance(license_info, dict):
            fail(f"{path}.license must be an object")
        for key in ("name", "notes"):
            require_string(license_info.get(key), f"{path}.license.{key}")
        require_url(license_info.get("url"), f"{path}.license.url")

        source_urls = entry["source_urls"]
        require_string_list(source_urls, f"{path}.source_urls")
        for source_index, source_url in enumerate(source_urls):
            require_url(source_url, f"{path}.source_urls[{source_index}]")

    print(f"catalog valid: {len(ids)} entries")


if __name__ == "__main__":
    validate()
