#!/usr/bin/env python3
"""Run small, reviewed public-data retrieval recipes safely."""

from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import math
import re
import socket
import sys
import time
from datetime import UTC, date, datetime
from itertools import product
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "catalog.json"
RECIPES_DIR = ROOT / "recipes"
VERSION = "0.4.0"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]+$")
VERSION_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")
BINDING_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*$")
BINDING_FORMAT_RE = re.compile(r"^[A-Za-z0-9._~-]*\{value\}[A-Za-z0-9._~-]*$")
INTEGER_RE = re.compile(r"^-?(?:0|[1-9][0-9]*)$")
NUMBER_RE = re.compile(r"^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$")
SHA256_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
RECEIPT_SCHEMA = (
    "https://raw.githubusercontent.com/yhay81/public-data-catalog/"
    "main/receipt.schema.json"
)
RECEIPT_VERSION = "1.1.0"
MAX_PROBE_CASES = 64
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


def _require_sha256(value: object, path: str) -> str:
    text = _require_string(value, path)
    if not SHA256_RE.fullmatch(text):
        raise RecipeError(f"{path} must be a sha256: digest")
    return text


def _require_datetime(value: object, path: str) -> str:
    text = _require_string(value, path)
    if "T" not in text or not (text.endswith("Z") or re.search(r"[+-][0-9]{2}:[0-9]{2}$", text)):
        raise RecipeError(f"{path} must be an ISO 8601 date-time with a timezone")
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RecipeError(f"{path} must be a valid ISO 8601 date-time: {exc}") from exc
    if parsed.tzinfo is None:
        raise RecipeError(f"{path} must include a timezone")
    return text


def _validate_receipt_document(receipt: object) -> dict[str, Any]:
    if not isinstance(receipt, dict):
        raise RecipeError("receipt must be an object")
    receipt_keys = {
        "$schema",
        "receipt_version",
        "receipt_id",
        "contract",
        "parameters",
        "request",
        "verification",
        "provenance",
        "results_sha256",
    }
    _require_exact_keys(receipt, receipt_keys, receipt_keys, "receipt")
    if receipt["$schema"] != RECEIPT_SCHEMA:
        raise RecipeError("receipt.$schema is not the supported receipt schema")
    if receipt["receipt_version"] != RECEIPT_VERSION:
        raise RecipeError(f"receipt.receipt_version must be {RECEIPT_VERSION}")
    _require_sha256(receipt["receipt_id"], "receipt.receipt_id")
    _require_sha256(receipt["results_sha256"], "receipt.results_sha256")

    contract = receipt["contract"]
    if not isinstance(contract, dict):
        raise RecipeError("receipt.contract must be an object")
    contract_keys = {"id", "version", "last_verified"}
    _require_exact_keys(contract, contract_keys, contract_keys, "receipt.contract")
    if not ID_RE.fullmatch(_require_string(contract["id"], "receipt.contract.id")):
        raise RecipeError("receipt.contract.id is not a valid identifier")
    if not VERSION_RE.fullmatch(_require_string(contract["version"], "receipt.contract.version")):
        raise RecipeError("receipt.contract.version must use semantic version format X.Y.Z")
    _parse_date(contract["last_verified"], "receipt.contract.last_verified")

    parameters = receipt["parameters"]
    if not isinstance(parameters, dict):
        raise RecipeError("receipt.parameters must be an object")
    for name, value in parameters.items():
        if not isinstance(name, str) or not ID_RE.fullmatch(name):
            raise RecipeError("receipt.parameters contains an invalid parameter name")
        if not isinstance(value, (str, int, float, bool)) or (
            isinstance(value, float) and not math.isfinite(value)
        ):
            raise RecipeError(f"receipt.parameters.{name} must be a scalar")

    request = receipt["request"]
    if not isinstance(request, dict):
        raise RecipeError("receipt.request must be an object")
    request_keys = {
        "method",
        "requested_url",
        "url",
        "retrieved_at",
        "elapsed_ms",
        "response_sha256",
    }
    _require_exact_keys(request, request_keys, request_keys, "receipt.request")
    if request["method"] != "GET":
        raise RecipeError("receipt.request.method must be GET")
    _validate_reference_url(request["requested_url"], "receipt.request.requested_url")
    _validate_reference_url(request["url"], "receipt.request.url")
    _require_datetime(request["retrieved_at"], "receipt.request.retrieved_at")
    if (
        isinstance(request["elapsed_ms"], bool)
        or not isinstance(request["elapsed_ms"], int)
        or request["elapsed_ms"] < 0
    ):
        raise RecipeError("receipt.request.elapsed_ms must be a non-negative integer")
    _require_sha256(request["response_sha256"], "receipt.request.response_sha256")

    verification = receipt["verification"]
    if not isinstance(verification, dict):
        raise RecipeError("receipt.verification must be an object")
    verification_keys = {"assertions_passed", "runner"}
    _require_exact_keys(
        verification,
        verification_keys,
        verification_keys,
        "receipt.verification",
    )
    if (
        isinstance(verification["assertions_passed"], bool)
        or not isinstance(verification["assertions_passed"], int)
        or verification["assertions_passed"] < 1
    ):
        raise RecipeError("receipt.verification.assertions_passed must be a positive integer")
    _require_string(verification["runner"], "receipt.verification.runner")

    provenance = receipt["provenance"]
    if not isinstance(provenance, dict):
        raise RecipeError("receipt.provenance must be an object")
    provenance_keys = {"source_id", "source_url", "license_url", "credit"}
    _require_exact_keys(provenance, provenance_keys, provenance_keys, "receipt.provenance")
    if not ID_RE.fullmatch(_require_string(provenance["source_id"], "receipt.provenance.source_id")):
        raise RecipeError("receipt.provenance.source_id is not a valid identifier")
    _validate_reference_url(provenance["source_url"], "receipt.provenance.source_url")
    _validate_reference_url(provenance["license_url"], "receipt.provenance.license_url")
    _require_string(provenance["credit"], "receipt.provenance.credit")
    return receipt


def validate_recipe_document(recipe: object, path: str = "recipe") -> dict[str, Any]:
    """Validate one recipe without third-party packages."""
    if not isinstance(recipe, dict):
        raise RecipeError(f"{path} must be an object")

    required = {
        "$schema",
        "id",
        "contract_version",
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
    _require_exact_keys(recipe, required, required | {"parameters"}, path)
    if recipe["$schema"] != "../recipe.schema.json":
        raise RecipeError(f"{path}.$schema must be ../recipe.schema.json")

    recipe_id = _require_string(recipe["id"], f"{path}.id")
    if not ID_RE.fullmatch(recipe_id):
        raise RecipeError(f"{path}.id must contain lowercase letters, digits, and hyphens")
    contract_version = _require_string(recipe["contract_version"], f"{path}.contract_version")
    if not VERSION_RE.fullmatch(contract_version):
        raise RecipeError(f"{path}.contract_version must use semantic version format X.Y.Z")
    _require_localized(recipe["title"], f"{path}.title")
    _require_localized(recipe["question"], f"{path}.question")
    _require_string(recipe["source_id"], f"{path}.source_id")

    parameters = recipe.get("parameters", {})
    if not isinstance(parameters, dict):
        raise RecipeError(f"{path}.parameters must be an object")
    if "parameters" in recipe and not parameters:
        raise RecipeError(f"{path}.parameters must not be empty")
    for parameter_name, parameter in parameters.items():
        parameter_path = f"{path}.parameters.{parameter_name}"
        if not ID_RE.fullmatch(parameter_name):
            raise RecipeError(
                f"{parameter_path} name must contain lowercase letters, digits, and hyphens"
            )
        if not isinstance(parameter, dict):
            raise RecipeError(f"{parameter_path} must be an object")
        parameter_keys = {"type", "description", "default", "minimum", "maximum"}
        _require_exact_keys(parameter, parameter_keys, parameter_keys, parameter_path)
        if parameter["type"] != "integer":
            raise RecipeError(f"{parameter_path}.type must be integer")
        _require_localized(parameter["description"], f"{parameter_path}.description")
        for number_key in ("default", "minimum", "maximum"):
            number = parameter[number_key]
            if isinstance(number, bool) or not isinstance(number, int):
                raise RecipeError(f"{parameter_path}.{number_key} must be an integer")
        if parameter["minimum"] > parameter["maximum"]:
            raise RecipeError(f"{parameter_path}.minimum must not exceed maximum")
        if not parameter["minimum"] <= parameter["default"] <= parameter["maximum"]:
            raise RecipeError(f"{parameter_path}.default must be within minimum and maximum")

    request = recipe["request"]
    if not isinstance(request, dict):
        raise RecipeError(f"{path}.request must be an object")
    request_required = {"method", "url", "allowed_hosts"}
    request_allowed = request_required | {"headers", "bindings"}
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

    bindings = request.get("bindings", [])
    if not isinstance(bindings, list):
        raise RecipeError(f"{path}.request.bindings must be an array")
    if parameters and not bindings:
        raise RecipeError(f"{path}.request.bindings is required when parameters are defined")
    if bindings and not parameters:
        raise RecipeError(f"{path}.request.bindings requires parameters")
    bound_parameters: set[str] = set()
    bound_query_names: set[str] = set()
    query_pairs = parse_qsl(urlparse(url).query, keep_blank_values=True)
    query_names = {name for name, _ in query_pairs}
    for index, binding in enumerate(bindings):
        binding_path = f"{path}.request.bindings[{index}]"
        if not isinstance(binding, dict):
            raise RecipeError(f"{binding_path} must be an object")
        binding_keys = {"parameter", "location", "name", "format"}
        _require_exact_keys(binding, binding_keys, binding_keys, binding_path)
        parameter_name = _require_string(binding["parameter"], f"{binding_path}.parameter")
        if parameter_name not in parameters:
            raise RecipeError(f"{binding_path}.parameter references an unknown parameter")
        if parameter_name in bound_parameters:
            raise RecipeError(f"{binding_path}.parameter must be unique")
        bound_parameters.add(parameter_name)
        if binding["location"] != "query":
            raise RecipeError(f"{binding_path}.location must be query")
        query_name = _require_string(binding["name"], f"{binding_path}.name")
        if not BINDING_NAME_RE.fullmatch(query_name):
            raise RecipeError(f"{binding_path}.name is not a safe query parameter name")
        if query_name.lower() in SECRET_KEYS:
            raise RecipeError(f"{binding_path}.name must not be secret-like")
        if query_name in bound_query_names:
            raise RecipeError(f"{binding_path}.name must be unique")
        if query_name not in query_names:
            raise RecipeError(f"{binding_path}.name must already exist in request.url")
        if sum(name == query_name for name, _ in query_pairs) != 1:
            raise RecipeError(f"{binding_path}.name must occur exactly once in request.url")
        bound_query_names.add(query_name)
        binding_format = _require_string(binding["format"], f"{binding_path}.format")
        if not BINDING_FORMAT_RE.fullmatch(binding_format):
            raise RecipeError(
                f"{binding_path}.format must contain exactly one safe {{value}} placeholder"
            )
    if bound_parameters != set(parameters):
        missing_parameters = ", ".join(sorted(set(parameters) - bound_parameters))
        raise RecipeError(f"{path}.request.bindings is missing parameter(s): {missing_parameters}")

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
        allowed = {"pointer", "equals", "equals_parameter", "minimum", "min_length"}
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
        if "equals_parameter" in assertion:
            parameter_assertion = assertion["equals_parameter"]
            if not isinstance(parameter_assertion, dict):
                raise RecipeError(f"{assertion_path}.equals_parameter must be an object")
            parameter_assertion_keys = {"parameter", "format"}
            _require_exact_keys(
                parameter_assertion,
                parameter_assertion_keys,
                parameter_assertion_keys,
                f"{assertion_path}.equals_parameter",
            )
            parameter_name = _require_string(
                parameter_assertion["parameter"],
                f"{assertion_path}.equals_parameter.parameter",
            )
            if parameter_name not in parameters:
                raise RecipeError(
                    f"{assertion_path}.equals_parameter.parameter references an unknown parameter"
                )
            assertion_format = _require_string(
                parameter_assertion["format"],
                f"{assertion_path}.equals_parameter.format",
            )
            if not BINDING_FORMAT_RE.fullmatch(assertion_format):
                raise RecipeError(
                    f"{assertion_path}.equals_parameter.format must contain exactly one "
                    "safe {value} placeholder"
                )

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
    if parameters:
        rendered_url = render_request_url(recipe, resolve_parameters(recipe))
        if rendered_url != url:
            raise RecipeError(
                f"{path}.request.url must equal the URL rendered from parameter defaults"
            )
    return recipe


def resolve_parameters(
    recipe: dict[str, Any],
    provided: dict[str, Any] | None = None,
) -> dict[str, int]:
    """Resolve supplied values against the reviewed parameter contract."""
    definitions = recipe.get("parameters", {})
    supplied = provided or {}
    if not isinstance(supplied, dict):
        raise RecipeError("parameters must be an object")
    unknown = sorted(set(supplied) - set(definitions))
    if unknown:
        raise RecipeError(f"unknown parameter(s): {', '.join(unknown)}")

    resolved: dict[str, int] = {}
    for name, definition in definitions.items():
        value = supplied.get(name, definition["default"])
        if isinstance(value, str) and re.fullmatch(r"-?[0-9]+", value):
            value = int(value)
        if isinstance(value, bool) or not isinstance(value, int):
            raise RecipeError(f"parameter {name!r} must be an integer")
        if value < definition["minimum"] or value > definition["maximum"]:
            raise RecipeError(
                f"parameter {name!r} must be from "
                f"{definition['minimum']} to {definition['maximum']}"
            )
        resolved[name] = value
    return resolved


def render_request_url(recipe: dict[str, Any], parameters: dict[str, int]) -> str:
    """Render only reviewed query bindings without allowing host or path changes."""
    request_config = recipe["request"]
    parsed = urlparse(request_config["url"])
    query = parse_qsl(parsed.query, keep_blank_values=True)
    replacements: dict[str, str] = {}
    for binding in request_config.get("bindings", []):
        replacements[binding["name"]] = binding["format"].replace(
            "{value}",
            str(parameters[binding["parameter"]]),
        )
    rendered_query = [
        (name, replacements.get(name, value))
        for name, value in query
    ]
    rendered = urlunparse(parsed._replace(query=urlencode(rendered_query)))
    allowed_hosts = [host.lower() for host in request_config["allowed_hosts"]]
    _validate_url_syntax(rendered, allowed_hosts, "rendered request URL")
    return rendered


def _canonical_json_sha256(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"


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


def _fetch_json(recipe: dict[str, Any], url: str) -> tuple[Any, str, int, str]:
    request_config = recipe["request"]
    allowed_hosts = [host.lower() for host in request_config["allowed_hosts"]]
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
    response_sha256 = f"sha256:{hashlib.sha256(raw).hexdigest()}"
    return document, final_url, elapsed_ms, response_sha256


def _check_assertions(
    recipe: dict[str, Any],
    document: Any,
    parameters: dict[str, int] | None = None,
) -> None:
    resolved_parameters = parameters or {}
    for assertion in recipe["expect"]["assertions"]:
        pointer = assertion["pointer"]
        value = resolve_json_pointer(document, pointer)
        if "equals" in assertion and value != assertion["equals"]:
            raise RecipeError(f"assertion failed at {pointer}: expected {assertion['equals']!r}, got {value!r}")
        if "equals_parameter" in assertion:
            parameter_assertion = assertion["equals_parameter"]
            parameter_name = parameter_assertion["parameter"]
            if parameter_name not in resolved_parameters:
                raise RecipeError(
                    f"assertion at {pointer} requires unresolved parameter {parameter_name!r}"
                )
            expected = parameter_assertion["format"].replace(
                "{value}",
                str(resolved_parameters[parameter_name]),
            )
            if value != expected:
                raise RecipeError(
                    f"assertion failed at {pointer}: expected {expected!r} from "
                    f"parameter {parameter_name!r}, got {value!r}"
                )
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


def _coerce_number(value: Any) -> int | float:
    if isinstance(value, bool):
        raise ValueError("booleans are not numbers")
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("number must be finite")
        return int(value) if value.is_integer() else value
    if isinstance(value, str) and NUMBER_RE.fullmatch(value):
        parsed = float(value)
        if not math.isfinite(parsed):
            raise ValueError("number must be finite")
        return int(parsed) if parsed.is_integer() else parsed
    raise ValueError("value is not a JSON number")


def _transform_value(value: Any, transform: str | None) -> Any:
    if transform is None:
        return value
    try:
        if transform == "string":
            if not isinstance(value, str):
                raise ValueError("value is not a string")
            return value
        if transform == "integer":
            if isinstance(value, bool):
                raise ValueError("booleans are not integers")
            if isinstance(value, int):
                return value
            if isinstance(value, float) and math.isfinite(value) and value.is_integer():
                return int(value)
            if isinstance(value, str) and INTEGER_RE.fullmatch(value):
                return int(value)
            raise ValueError("value is not an integer")
        if transform == "number":
            return _coerce_number(value)
        if transform == "unix_milliseconds_to_iso8601":
            return (
                datetime.fromtimestamp(_coerce_number(value) / 1000, tz=UTC)
                .isoformat(timespec="milliseconds")
                .replace("+00:00", "Z")
            )
    except (OverflowError, TypeError, ValueError) as exc:
        raise RecipeError(f"could not apply {transform!r} transform to {value!r}") from exc
    raise RecipeError(f"unsupported transform: {transform}")


def execute_recipe(
    recipe: dict[str, Any],
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resolved_parameters = resolve_parameters(recipe, parameters)
    request_url = render_request_url(recipe, resolved_parameters)
    document, final_url, elapsed_ms, response_sha256 = _fetch_json(recipe, request_url)
    _check_assertions(recipe, document, resolved_parameters)
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

    retrieved_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    receipt_body = {
        "$schema": RECEIPT_SCHEMA,
        "receipt_version": RECEIPT_VERSION,
        "contract": {
            "id": recipe["id"],
            "version": recipe["contract_version"],
            "last_verified": recipe["last_verified"],
        },
        "parameters": resolved_parameters,
        "request": {
            "method": "GET",
            "requested_url": request_url,
            "url": final_url,
            "retrieved_at": retrieved_at,
            "elapsed_ms": elapsed_ms,
            "response_sha256": response_sha256,
        },
        "verification": {
            "assertions_passed": len(recipe["expect"]["assertions"]),
            "runner": f"public-data-catalog-recipe-runner/{VERSION}",
        },
        "provenance": {
            "source_id": recipe["source_id"],
            **recipe["attribution"],
        },
        "results_sha256": _canonical_json_sha256(values),
    }
    receipt = {
        **receipt_body,
        "receipt_id": _canonical_json_sha256(receipt_body),
    }
    return {
        "status": "ok",
        "recipe_id": recipe["id"],
        "contract_version": recipe["contract_version"],
        "question": recipe["question"],
        "parameters": resolved_parameters,
        "retrieved_at": retrieved_at,
        "elapsed_ms": elapsed_ms,
        "request_url": final_url,
        "results": values,
        "interpretation": recipe["interpretation"],
        "provenance": {
            "source_id": recipe["source_id"],
            **recipe["attribution"],
            "recipe_last_verified": recipe["last_verified"],
        },
        "receipt": receipt,
    }


def verify_execution_result(result: object) -> dict[str, Any]:
    """Verify a saved execution result against its receipt and reviewed recipe."""
    if not isinstance(result, dict):
        raise RecipeError("execution result must be an object")
    receipt = result.get("receipt")
    results = result.get("results")
    if not isinstance(receipt, dict) or not isinstance(results, dict):
        raise RecipeError("execution result must contain receipt and results objects")
    _validate_receipt_document(receipt)
    receipt_id = receipt["receipt_id"]
    receipt_body = {key: value for key, value in receipt.items() if key != "receipt_id"}
    expected_receipt_id = _canonical_json_sha256(receipt_body)
    expected_results_hash = _canonical_json_sha256(results)
    contract = receipt.get("contract")
    request = receipt.get("request")
    provenance = receipt.get("provenance")
    verification = receipt.get("verification")
    contract_binding = (
        isinstance(contract, dict)
        and result.get("recipe_id") == contract.get("id")
        and result.get("contract_version") == contract.get("version")
    )
    parameters_binding = result.get("parameters") == receipt.get("parameters")
    request_binding = (
        isinstance(request, dict)
        and result.get("request_url") == request.get("url")
        and result.get("retrieved_at") == request.get("retrieved_at")
        and result.get("elapsed_ms") == request.get("elapsed_ms")
    )
    provenance_binding = (
        isinstance(contract, dict)
        and isinstance(provenance, dict)
        and result.get("provenance")
        == {
            **provenance,
            "recipe_last_verified": contract.get("last_verified"),
        }
    )
    catalog_binding = False
    if (
        isinstance(contract, dict)
        and isinstance(request, dict)
        and isinstance(provenance, dict)
        and isinstance(contract.get("id"), str)
    ):
        recipe = load_recipes().get(contract["id"])
        if recipe is not None:
            try:
                receipt_parameters = receipt.get("parameters")
                if not isinstance(receipt_parameters, dict):
                    raise RecipeError("receipt.parameters must be an object")
                resolved_parameters = resolve_parameters(recipe, receipt_parameters)
                expected_requested_url = render_request_url(recipe, resolved_parameters)
                requested_url = str(request.get("requested_url"))
                _validate_url_syntax(
                    requested_url,
                    recipe["request"]["allowed_hosts"],
                    "receipt.request.requested_url",
                )
                _validate_url_syntax(
                    str(request.get("url")),
                    recipe["request"]["allowed_hosts"],
                    "receipt.request.url",
                )
                catalog_binding = (
                    contract
                    == {
                        "id": recipe["id"],
                        "version": recipe["contract_version"],
                        "last_verified": recipe["last_verified"],
                    }
                    and provenance
                    == {
                        "source_id": recipe["source_id"],
                        **recipe["attribution"],
                    }
                    and result.get("question") == recipe["question"]
                    and result.get("interpretation") == recipe["interpretation"]
                    and request.get("method") == recipe["request"]["method"]
                    and requested_url == expected_requested_url
                    and receipt_parameters == resolved_parameters
                    and isinstance(verification, dict)
                    and verification.get("assertions_passed")
                    == len(recipe["expect"]["assertions"])
                )
            except (RecipeError, TypeError, ValueError):
                catalog_binding = False
    checks = {
        "receipt_integrity": receipt_id == expected_receipt_id,
        "results_integrity": receipt.get("results_sha256") == expected_results_hash,
        "execution_status": result.get("status") == "ok",
        "contract_binding": contract_binding,
        "parameters_binding": parameters_binding,
        "request_binding": request_binding,
        "provenance_binding": provenance_binding,
        "catalog_binding": catalog_binding,
    }
    return {
        "valid": all(checks.values()),
        "receipt_id": receipt_id,
        "checks": checks,
    }


def _probe_parameter_sets(recipe: dict[str, Any]) -> list[dict[str, int]]:
    definitions = recipe.get("parameters", {})
    if not definitions:
        return [{}]
    names = list(definitions)
    value_sets = [
        range(definitions[name]["minimum"], definitions[name]["maximum"] + 1)
        for name in names
    ]
    case_count = math.prod(len(values) for values in value_sets)
    if case_count > MAX_PROBE_CASES:
        raise RecipeError(
            f"recipe {recipe['id']!r} defines {case_count} probe combinations; "
            f"maximum is {MAX_PROBE_CASES}"
        )
    return [dict(zip(names, values, strict=True)) for values in product(*value_sets)]


def _display_text_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def _format_text_result(result: dict[str, Any]) -> str:
    lines = [
        f"質問: {result['question']['ja']}",
    ]
    if result.get("parameters"):
        rendered_parameters = ", ".join(
            f"{name}={value}" for name, value in result["parameters"].items()
        )
        lines.append(f"パラメータ: {rendered_parameters}")
    lines.append("結果:")
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
    if isinstance(result.get("receipt"), dict):
        lines.append(f"実行レシート: {result['receipt']['receipt_id']}")
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
        "--param",
        action="append",
        default=[],
        metavar="NAME=VALUE",
        help="supply a reviewed recipe parameter; may be repeated",
    )
    run_parser.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        dest="output_format",
        help="output format (default: json)",
    )
    check_parser = subparsers.add_parser("check", help="run recipe probes")
    check_parser.add_argument("recipe_id", nargs="?")
    verify_parser = subparsers.add_parser(
        "verify",
        help="verify the integrity of a saved JSON execution result",
    )
    verify_parser.add_argument(
        "input",
        nargs="?",
        default="-",
        help="result file, or - for standard input (default: -)",
    )
    return parser


def _parse_cli_parameters(items: list[str]) -> dict[str, str]:
    parameters: dict[str, str] = {}
    for item in items:
        if "=" not in item:
            raise RecipeError(f"parameter must use NAME=VALUE: {item!r}")
        name, value = item.split("=", 1)
        if not name or not value:
            raise RecipeError(f"parameter must use NAME=VALUE: {item!r}")
        if name in parameters:
            raise RecipeError(f"duplicate parameter: {name}")
        parameters[name] = value
    return parameters


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "verify":
            try:
                serialized = (
                    sys.stdin.read()
                    if args.input == "-"
                    else Path(args.input).read_text(encoding="utf-8")
                )
                execution = json.loads(serialized)
            except (OSError, json.JSONDecodeError) as exc:
                raise RecipeError(f"could not read execution result: {exc}") from exc
            verification = verify_execution_result(execution)
            print(json.dumps(verification, ensure_ascii=False, indent=2))
            return 0 if verification["valid"] else 1

        recipes = load_recipes()
        if args.command == "list":
            if args.json:
                payload = [
                    {
                        "id": recipe["id"],
                        "contract_version": recipe["contract_version"],
                        "title": recipe["title"],
                        "question": recipe["question"],
                        "source_id": recipe["source_id"],
                        "parameters": recipe.get("parameters", {}),
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
            result = execute_recipe(
                _get_recipe(recipes, args.recipe_id),
                _parse_cli_parameters(args.param),
            )
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
                for parameters in _probe_parameter_sets(recipe):
                    parameter_text = " ".join(
                        f"{name}={value}" for name, value in parameters.items()
                    )
                    label = f"{recipe['id']} {parameter_text}".rstrip()
                    try:
                        result = execute_recipe(recipe, parameters)
                    except RecipeError as exc:
                        failures += 1
                        print(f"[failed] {label}: {exc}", file=sys.stderr)
                    else:
                        print(f"[ok] {label} ({result['elapsed_ms']} ms)")
            return 1 if failures else 0
    except RecipeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    parser.error("unhandled command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
