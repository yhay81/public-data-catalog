#!/usr/bin/env python3
"""Run small, reviewed public-data retrieval recipes safely."""

from __future__ import annotations

import argparse
import ipaddress
import json
import re
import socket
import sys
import time
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "catalog.json"
RECIPES_DIR = ROOT / "recipes"
VERSION = "0.3.1"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]+$")
SECRET_KEYS = {
    "access_token",
    "api_key",
    "apikey",
    "app_id",
    "appid",
    "client_secret",
    "token",
}
ALLOWED_REQUEST_HEADERS = {"Accept"}
ALLOWED_TRANSFORMS = {
    "integer",
    "number",
    "string",
    "unix_milliseconds_to_iso8601",
}
USER_AGENT = (
    f"public-data-catalog-recipe-runner/{VERSION} "
    "(+https://github.com/yhay81/public-data-catalog)"
)


class RecipeError(RuntimeError):
    """A recipe is invalid or could not be executed safely."""


def _require_string(value: object, path: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise RecipeError(f"{path} must be a non-empty string")
    return value


def _require_exact_keys(value: dict[str, Any], required: set[str], allowed: set[str], path: str) -> None:
    missing = sorted(required - value.keys())
    unknown = sorted(value.keys() - allowed)
    if missing:
        raise RecipeError(f"{path} is missing: {', '.join(missing)}")
    if unknown:
        raise RecipeError(f"{path} has unknown field(s): {', '.join(unknown)}")


def _require_localized(value: object, path: str) -> None:
    if not isinstance(value, dict):
        raise RecipeError(f"{path} must be an object")
    _require_exact_keys(value, {"ja", "en"}, {"ja", "en"}, path)
    _require_string(value["ja"], f"{path}.ja")
    _require_string(value["en"], f"{path}.en")


def _require_string_list(value: object, path: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise RecipeError(f"{path} must be a non-empty array")
    result: list[str] = []
    for index, item in enumerate(value):
        result.append(_require_string(item, f"{path}[{index}]"))
    return result


def _parse_date(value: object, path: str) -> date:
    text = _require_string(value, path)
    try:
        parsed = date.fromisoformat(text)
    except ValueError as exc:
        raise RecipeError(f"{path} must be a valid YYYY-MM-DD date: {exc}") from exc
    if parsed > date.today():
        raise RecipeError(f"{path} cannot be in the future")
    return parsed


def _validate_default_https_port(parsed: Any, path: str) -> None:
    try:
        port = parsed.port
    except ValueError as exc:
        raise RecipeError(f"{path} has an invalid port") from exc
    if port not in {None, 443}:
        raise RecipeError(f"{path} must use the default HTTPS port")


def _validate_url_syntax(url: str, allowed_hosts: list[str], path: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise RecipeError(f"{path} must use HTTPS")
    if not parsed.hostname:
        raise RecipeError(f"{path} must have a host")
    if parsed.username or parsed.password:
        raise RecipeError(f"{path} must not contain credentials")
    _validate_default_https_port(parsed, path)
    if parsed.fragment:
        raise RecipeError(f"{path} must not contain a fragment")
    host = parsed.hostname.lower()
    if host not in allowed_hosts:
        raise RecipeError(f"{path} host {host!r} is not in request.allowed_hosts")
    query_keys = {key.lower() for key in parse_qs(parsed.query, keep_blank_values=True)}
    leaked = sorted(query_keys & SECRET_KEYS)
    if leaked:
        raise RecipeError(f"{path} contains secret-like query field(s): {', '.join(leaked)}")


def _validate_reference_url(url: object, path: str) -> None:
    text = _require_string(url, path)
    parsed = urlparse(text)
    if parsed.scheme != "https" or not parsed.hostname:
        raise RecipeError(f"{path} must be an absolute HTTPS URL")
    if parsed.username or parsed.password:
        raise RecipeError(f"{path} must not contain credentials")
    _validate_default_https_port(parsed, path)
    if parsed.fragment:
        raise RecipeError(f"{path} must not contain a fragment")
    query_keys = {key.lower() for key in parse_qs(parsed.query, keep_blank_values=True)}
    leaked = sorted(query_keys & SECRET_KEYS)
    if leaked:
        raise RecipeError(f"{path} contains secret-like query field(s): {', '.join(leaked)}")


def validate_recipe_document(recipe: object, path: str = "recipe") -> dict[str, Any]:
    """Validate one recipe without third-party packages."""
    if not isinstance(recipe, dict):
        raise RecipeError(f"{path} must be an object")

    required = {
        "$schema",
        "id",
        "title",
        "question",
        "source_id",
        "request",
        "expect",
        "result",
        "interpretation",
        "attribution",
        "last_verified",
    }
    _require_exact_keys(recipe, required, required, path)
    if recipe["$schema"] != "../recipe.schema.json":
        raise RecipeError(f"{path}.$schema must be ../recipe.schema.json")

    recipe_id = _require_string(recipe["id"], f"{path}.id")
    if not ID_RE.fullmatch(recipe_id):
        raise RecipeError(f"{path}.id must contain lowercase letters, digits, and hyphens")
    _require_localized(recipe["title"], f"{path}.title")
    _require_localized(recipe["question"], f"{path}.question")
    _require_string(recipe["source_id"], f"{path}.source_id")

    request = recipe["request"]
    if not isinstance(request, dict):
        raise RecipeError(f"{path}.request must be an object")
    request_required = {"method", "url", "allowed_hosts"}
    request_allowed = request_required | {"headers"}
    _require_exact_keys(request, request_required, request_allowed, f"{path}.request")
    if request["method"] != "GET":
        raise RecipeError(f"{path}.request.method must be GET")
    hosts = _require_string_list(request["allowed_hosts"], f"{path}.request.allowed_hosts")
    normalized_hosts = [host.lower() for host in hosts]
    if len(normalized_hosts) != len(set(normalized_hosts)):
        raise RecipeError(f"{path}.request.allowed_hosts must be unique")
    for index, host in enumerate(normalized_hosts):
        if host == "localhost" or host.endswith(".local"):
            raise RecipeError(f"{path}.request.allowed_hosts[{index}] is not a public host")
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            if not address.is_global:
                raise RecipeError(f"{path}.request.allowed_hosts[{index}] is not a global address")
    url = _require_string(request["url"], f"{path}.request.url")
    _validate_url_syntax(url, normalized_hosts, f"{path}.request.url")

    headers = request.get("headers", {})
    if not isinstance(headers, dict):
        raise RecipeError(f"{path}.request.headers must be an object")
    unknown_headers = sorted(set(headers) - ALLOWED_REQUEST_HEADERS)
    if unknown_headers:
        raise RecipeError(f"{path}.request.headers contains unsafe field(s): {', '.join(unknown_headers)}")
    for key, value in headers.items():
        header_value = _require_string(value, f"{path}.request.headers.{key}")
        if "\r" in header_value or "\n" in header_value:
            raise RecipeError(f"{path}.request.headers.{key} must not contain line breaks")

    expect = recipe["expect"]
    if not isinstance(expect, dict):
        raise RecipeError(f"{path}.expect must be an object")
    expect_required = {"status", "content_type_contains", "max_bytes", "assertions"}
    _require_exact_keys(expect, expect_required, expect_required, f"{path}.expect")
    if expect["status"] != 200:
        raise RecipeError(f"{path}.expect.status must be 200")
    _require_string(expect["content_type_contains"], f"{path}.expect.content_type_contains")
    if not isinstance(expect["max_bytes"], int) or not 1024 <= expect["max_bytes"] <= 1_000_000:
        raise RecipeError(f"{path}.expect.max_bytes must be an integer from 1024 to 1000000")
    assertions = expect["assertions"]
    if not isinstance(assertions, list) or not assertions:
        raise RecipeError(f"{path}.expect.assertions must be a non-empty array")
    for index, assertion in enumerate(assertions):
        assertion_path = f"{path}.expect.assertions[{index}]"
        if not isinstance(assertion, dict):
            raise RecipeError(f"{assertion_path} must be an object")
        allowed = {"pointer", "equals", "minimum", "min_length"}
        _require_exact_keys(assertion, {"pointer"}, allowed, assertion_path)
        _require_string(assertion["pointer"], f"{assertion_path}.pointer")
        checks = set(assertion) - {"pointer"}
        if len(checks) != 1:
            raise RecipeError(f"{assertion_path} must define exactly one check")
        if "minimum" in assertion and (
            isinstance(assertion["minimum"], bool)
            or not isinstance(assertion["minimum"], (int, float))
        ):
            raise RecipeError(f"{assertion_path}.minimum must be numeric")
        if "min_length" in assertion and (
            not isinstance(assertion["min_length"], int) or assertion["min_length"] < 0
        ):
            raise RecipeError(f"{assertion_path}.min_length must be a non-negative integer")

    result = recipe["result"]
    if not isinstance(result, dict):
        raise RecipeError(f"{path}.result must be an object")
    _require_exact_keys(result, {"fields"}, {"fields"}, f"{path}.result")
    fields = result["fields"]
    if not isinstance(fields, list) or not fields:
        raise RecipeError(f"{path}.result.fields must be a non-empty array")
    field_names: set[str] = set()
    for index, field in enumerate(fields):
        field_path = f"{path}.result.fields[{index}]"
        if not isinstance(field, dict):
            raise RecipeError(f"{field_path} must be an object")
        field_required = {"name", "label", "pointer"}
        field_allowed = field_required | {"unit", "description", "transform"}
        _require_exact_keys(field, field_required, field_allowed, field_path)
        name = _require_string(field["name"], f"{field_path}.name")
        if not ID_RE.fullmatch(name):
            raise RecipeError(f"{field_path}.name must contain lowercase letters, digits, and hyphens")
        if name in field_names:
            raise RecipeError(f"{path}.result.fields contains duplicate name {name!r}")
        field_names.add(name)
        _require_localized(field["label"], f"{field_path}.label")
        _require_string(field["pointer"], f"{field_path}.pointer")
        for optional_key in ("unit", "description"):
            if optional_key in field:
                _require_string(field[optional_key], f"{field_path}.{optional_key}")
        if "transform" in field and field["transform"] not in ALLOWED_TRANSFORMS:
            raise RecipeError(
                f"{field_path}.transform must be one of: {', '.join(sorted(ALLOWED_TRANSFORMS))}"
            )

    _require_string_list(recipe["interpretation"], f"{path}.interpretation")
    attribution = recipe["attribution"]
    if not isinstance(attribution, dict):
        raise RecipeError(f"{path}.attribution must be an object")
    attribution_required = {"source_url", "license_url", "credit"}
    _require_exact_keys(attribution, attribution_required, attribution_required, f"{path}.attribution")
    _validate_reference_url(attribution["source_url"], f"{path}.attribution.source_url")
    _validate_reference_url(attribution["license_url"], f"{path}.attribution.license_url")
    _require_string(attribution["credit"], f"{path}.attribution.credit")
    _parse_date(recipe["last_verified"], f"{path}.last_verified")
    return recipe


def load_catalog() -> dict[str, dict[str, Any]]:
    try:
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RecipeError(f"could not load {CATALOG_PATH}: {exc}") from exc
    entries = catalog.get("entries")
    if not isinstance(entries, list):
        raise RecipeError("catalog.entries must be an array")
    sources: dict[str, dict[str, Any]] = {}
    for index, entry in enumerate(entries):
        path = f"catalog.entries[{index}]"
        if not isinstance(entry, dict):
            raise RecipeError(f"{path} must be an object")
        source_id = _require_string(entry.get("id"), f"{path}.id")
        if source_id in sources:
            raise RecipeError(f"duplicate catalog entry id: {source_id}")
        source_urls = entry.get("source_urls")
        if not isinstance(source_urls, list) or not all(isinstance(item, str) for item in source_urls):
            raise RecipeError(f"{path}.source_urls must be an array of strings")
        license_info = entry.get("license")
        if not isinstance(license_info, dict) or not isinstance(license_info.get("url"), str):
            raise RecipeError(f"{path}.license.url must be a string")
        sources[source_id] = entry
    return sources


def load_recipes() -> dict[str, dict[str, Any]]:
    recipes: dict[str, dict[str, Any]] = {}
    if not RECIPES_DIR.is_dir():
        raise RecipeError(f"recipe directory does not exist: {RECIPES_DIR}")
    for recipe_path in sorted(RECIPES_DIR.glob("*.json")):
        try:
            document = json.loads(recipe_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RecipeError(f"could not load {recipe_path}: {exc}") from exc
        recipe = validate_recipe_document(document, str(recipe_path.relative_to(ROOT)))
        recipe_id = recipe["id"]
        if recipe_path.stem != recipe_id:
            raise RecipeError(
                f"{recipe_path.relative_to(ROOT)} filename must match recipe id {recipe_id!r}"
            )
        if recipe_id in recipes:
            raise RecipeError(f"duplicate recipe id: {recipe_id}")
        recipes[recipe_id] = recipe
    if not recipes:
        raise RecipeError("no recipes found")

    catalog = load_catalog()
    for recipe_id, recipe in recipes.items():
        source_id = recipe["source_id"]
        if source_id not in catalog:
            raise RecipeError(f"recipe {recipe_id!r} references unknown source_id {source_id!r}")
        source_urls = set(catalog[source_id]["source_urls"])
        if recipe["attribution"]["source_url"] not in source_urls:
            raise RecipeError(
                f"recipe {recipe_id!r} attribution.source_url must be listed in catalog source_urls"
            )
        if recipe["attribution"]["license_url"] != catalog[source_id]["license"]["url"]:
            raise RecipeError(
                f"recipe {recipe_id!r} attribution.license_url must match the catalog license URL"
            )
    return recipes


def resolve_json_pointer(document: Any, pointer: str) -> Any:
    """Resolve RFC 6901 JSON Pointer syntax."""
    if pointer == "":
        return document
    if not pointer.startswith("/"):
        raise RecipeError(f"JSON pointer must start with '/': {pointer!r}")
    current = document
    for raw_token in pointer[1:].split("/"):
        token = raw_token.replace("~1", "/").replace("~0", "~")
        if isinstance(current, list):
            if not re.fullmatch(r"0|[1-9][0-9]*", token):
                raise RecipeError(f"JSON pointer does not resolve: {pointer!r}")
            try:
                current = current[int(token)]
            except IndexError as exc:
                raise RecipeError(f"JSON pointer does not resolve: {pointer!r}") from exc
        elif isinstance(current, dict):
            if token not in current:
                raise RecipeError(f"JSON pointer does not resolve: {pointer!r}")
            current = current[token]
        else:
            raise RecipeError(f"JSON pointer does not resolve: {pointer!r}")
    return current


def _ensure_public_dns(host: str) -> None:
    try:
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise RecipeError(f"could not resolve {host}: {exc}") from exc
    if not addresses:
        raise RecipeError(f"could not resolve {host}")
    for address in addresses:
        ip_text = address[4][0]
        ip = ipaddress.ip_address(ip_text)
        if not ip.is_global:
            raise RecipeError(f"{host} resolved to non-public address {ip}")


class _SafeRedirectHandler(HTTPRedirectHandler):
    def __init__(self, allowed_hosts: list[str]) -> None:
        super().__init__()
        self.allowed_hosts = allowed_hosts

    def redirect_request(
        self,
        req: Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> Request | None:
        _validate_url_syntax(newurl, self.allowed_hosts, "redirect URL")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _fetch_json(recipe: dict[str, Any]) -> tuple[Any, str, int]:
    request_config = recipe["request"]
    allowed_hosts = [host.lower() for host in request_config["allowed_hosts"]]
    url = request_config["url"]
    _validate_url_syntax(url, allowed_hosts, "request.url")
    for host in allowed_hosts:
        _ensure_public_dns(host)

    headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    headers.update(request_config.get("headers", {}))
    request = Request(url, headers=headers, method="GET")
    opener = build_opener(_SafeRedirectHandler(allowed_hosts))
    expected = recipe["expect"]
    max_bytes = expected["max_bytes"]

    started = time.monotonic()
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            with opener.open(request, timeout=20) as response:
                final_url = response.geturl()
                _validate_url_syntax(final_url, allowed_hosts, "response URL")
                status = response.status
                content_type = response.headers.get("Content-Type", "")
                raw = response.read(max_bytes + 1)
            break
        except HTTPError as exc:
            last_error = exc
            if exc.code != 429 and exc.code < 500:
                raise RecipeError(f"HTTP {exc.code} for {url}") from exc
        except (TimeoutError, URLError, OSError) as exc:
            last_error = exc
        if attempt == 0:
            time.sleep(1)
    else:
        raise RecipeError(f"request failed for {url}: {last_error}") from last_error

    if len(raw) > max_bytes:
        raise RecipeError(f"response exceeded {max_bytes} bytes")
    if status != expected["status"]:
        raise RecipeError(f"expected HTTP {expected['status']}, got {status}")
    if expected["content_type_contains"].lower() not in content_type.lower():
        raise RecipeError(
            f"expected content type containing {expected['content_type_contains']!r}, got {content_type!r}"
        )
    try:
        document = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RecipeError(f"response was not valid JSON: {exc}") from exc
    elapsed_ms = round((time.monotonic() - started) * 1000)
    return document, final_url, elapsed_ms


def _check_assertions(recipe: dict[str, Any], document: Any) -> None:
    for assertion in recipe["expect"]["assertions"]:
        pointer = assertion["pointer"]
        value = resolve_json_pointer(document, pointer)
        if "equals" in assertion and value != assertion["equals"]:
            raise RecipeError(f"assertion failed at {pointer}: expected {assertion['equals']!r}, got {value!r}")
        if "minimum" in assertion:
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or value < assertion["minimum"]
            ):
                raise RecipeError(
                    f"assertion failed at {pointer}: expected at least {assertion['minimum']}, got {value!r}"
                )
        if "min_length" in assertion:
            if not hasattr(value, "__len__") or len(value) < assertion["min_length"]:
                raise RecipeError(
                    f"assertion failed at {pointer}: expected length at least "
                    f"{assertion['min_length']}, got {value!r}"
                )


def _transform_value(value: Any, transform: str | None) -> Any:
    if transform is None:
        return value
    try:
        if transform == "string":
            return str(value)
        if transform == "integer":
            return int(value)
        if transform == "number":
            return float(value)
        if transform == "unix_milliseconds_to_iso8601":
            return (
                datetime.fromtimestamp(float(value) / 1000, tz=UTC)
                .isoformat()
                .replace("+00:00", "Z")
            )
    except (OverflowError, TypeError, ValueError) as exc:
        raise RecipeError(f"could not apply {transform!r} transform to {value!r}") from exc
    raise RecipeError(f"unsupported transform: {transform}")


def execute_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    document, final_url, elapsed_ms = _fetch_json(recipe)
    _check_assertions(recipe, document)
    values: dict[str, dict[str, Any]] = {}
    for field in recipe["result"]["fields"]:
        item: dict[str, Any] = {
            "label": field["label"],
            "value": _transform_value(
                resolve_json_pointer(document, field["pointer"]),
                field.get("transform"),
            ),
        }
        for optional_key in ("unit", "description"):
            if optional_key in field:
                item[optional_key] = field[optional_key]
        values[field["name"]] = item

    return {
        "status": "ok",
        "recipe_id": recipe["id"],
        "question": recipe["question"],
        "retrieved_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "elapsed_ms": elapsed_ms,
        "request_url": final_url,
        "results": values,
        "interpretation": recipe["interpretation"],
        "provenance": {
            "source_id": recipe["source_id"],
            **recipe["attribution"],
            "recipe_last_verified": recipe["last_verified"],
        },
    }


def _display_text_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def _format_text_result(result: dict[str, Any]) -> str:
    lines = [
        f"質問: {result['question']['ja']}",
        "結果:",
    ]
    for item in result["results"].values():
        value = _display_text_value(item["value"])
        unit = f" {item['unit']}" if "unit" in item else ""
        lines.append(f"- {item['label']['ja']}: {value}{unit}")

    lines.append("解釈上の注意:")
    lines.extend(f"- {note}" for note in result["interpretation"])

    provenance = result["provenance"]
    lines.extend(
        [
            f"情報源: {provenance['source_id']}",
            f"出典表記: {provenance['credit']}",
            f"公式情報: {provenance['source_url']}",
            f"ライセンス: {provenance['license_url']}",
            f"レシピ確認日: {provenance['recipe_last_verified']}",
            f"取得URL: {result['request_url']}",
            f"取得日時: {result['retrieved_at']}",
        ]
    )
    return "\n".join(lines)


def _get_recipe(recipes: dict[str, dict[str, Any]], recipe_id: str) -> dict[str, Any]:
    try:
        return recipes[recipe_id]
    except KeyError as exc:
        choices = ", ".join(sorted(recipes))
        raise RecipeError(f"unknown recipe {recipe_id!r}; choose one of: {choices}") from exc


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", action="version", version=f"%(prog)s {VERSION}")
    subparsers = parser.add_subparsers(dest="command", required=True)
    list_parser = subparsers.add_parser("list", help="list available recipes")
    list_parser.add_argument("--json", action="store_true", help="emit JSON")
    show_parser = subparsers.add_parser("show", help="show one recipe")
    show_parser.add_argument("recipe_id")
    run_parser = subparsers.add_parser("run", help="run one recipe and print attributed results")
    run_parser.add_argument("recipe_id")
    run_parser.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        dest="output_format",
        help="output format (default: json)",
    )
    check_parser = subparsers.add_parser("check", help="run recipe probes")
    check_parser.add_argument("recipe_id", nargs="?")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        recipes = load_recipes()
        if args.command == "list":
            if args.json:
                payload = [
                    {
                        "id": recipe["id"],
                        "title": recipe["title"],
                        "question": recipe["question"],
                        "source_id": recipe["source_id"],
                    }
                    for recipe in recipes.values()
                ]
                print(json.dumps(payload, ensure_ascii=False, indent=2))
            else:
                for recipe in recipes.values():
                    print(f"{recipe['id']}\t{recipe['question']['ja']}")
            return 0
        if args.command == "show":
            print(json.dumps(_get_recipe(recipes, args.recipe_id), ensure_ascii=False, indent=2))
            return 0
        if args.command == "run":
            result = execute_recipe(_get_recipe(recipes, args.recipe_id))
            if args.output_format == "text":
                print(_format_text_result(result))
            else:
                print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0
        if args.command == "check":
            selected = (
                [_get_recipe(recipes, args.recipe_id)]
                if args.recipe_id
                else list(recipes.values())
            )
            failures = 0
            for recipe in selected:
                try:
                    result = execute_recipe(recipe)
                except RecipeError as exc:
                    failures += 1
                    print(f"[failed] {recipe['id']}: {exc}", file=sys.stderr)
                else:
                    print(f"[ok] {recipe['id']} ({result['elapsed_ms']} ms)")
            return 1 if failures else 0
    except RecipeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    parser.error("unhandled command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
