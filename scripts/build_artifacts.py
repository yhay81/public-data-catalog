#!/usr/bin/env python3
"""Build deterministic interoperability artifacts from the catalog sources."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from recipe_tool import CATALOG_PATH, ROOT, load_recipes


GENERATED_DIR = ROOT / "generated"


def _json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _build_bundle(catalog: dict[str, Any], recipes: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "bundle_version": "1.0.0",
        "catalog_version": catalog["catalog_version"],
        "last_updated": catalog["last_updated"],
        "sources": catalog["entries"],
        "recipes": list(recipes.values()),
    }


def _dcat_item(entry: dict[str, Any]) -> dict[str, Any]:
    item_type = (
        "dcat:DataService"
        if entry["type"] in {"api", "portal"}
        else "dcat:Dataset"
    )
    item: dict[str, Any] = {
        "@id": f"https://github.com/yhay81/public-data-catalog#source-{entry['id']}",
        "@type": item_type,
        "dct:identifier": entry["id"],
        "dct:title": entry["title"],
        "dct:description": entry["ai_summary"],
        "dct:publisher": entry["publisher"],
        "dct:modified": entry["last_verified"],
        "dct:license": {"@id": entry["license"]["url"]},
        "dcat:keyword": entry["domains"],
        "dcat:landingPage": {"@id": entry["access"]["docs_url"]},
    }
    if item_type == "dcat:DataService":
        item["dcat:endpointURL"] = {"@id": entry["access"]["base_url"]}
        item["dcat:endpointDescription"] = {"@id": entry["access"]["docs_url"]}
    else:
        item["dcat:distribution"] = {
            "@type": "dcat:Distribution",
            "dcat:accessURL": {"@id": entry["access"]["base_url"]},
            "dct:format": entry["access"]["formats"],
        }
    return item


def _build_dcat(catalog: dict[str, Any]) -> dict[str, Any]:
    entries = [_dcat_item(entry) for entry in catalog["entries"]]
    services = [item for item in entries if item["@type"] == "dcat:DataService"]
    datasets = [item for item in entries if item["@type"] == "dcat:Dataset"]
    return {
        "@context": {
            "dcat": "http://www.w3.org/ns/dcat#",
            "dct": "http://purl.org/dc/terms/",
        },
        "@id": "https://github.com/yhay81/public-data-catalog",
        "@type": "dcat:Catalog",
        "dct:title": "Public Data Catalog — Verified Recipes for Japan",
        "dct:description": (
            "Japanese-first public-data source profiles with reviewed, "
            "executable retrieval contracts."
        ),
        "dct:modified": catalog["last_updated"],
        "dct:license": {"@id": "https://opensource.org/license/mit"},
        "dcat:service": services,
        "dcat:dataset": datasets,
    }


def build_outputs() -> dict[Path, bytes]:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    recipes = load_recipes()
    return {
        GENERATED_DIR / "catalog.bundle.json": _json_bytes(_build_bundle(catalog, recipes)),
        GENERATED_DIR / "catalog.dcat.jsonld": _json_bytes(_build_dcat(catalog)),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail if committed artifacts differ from their source files",
    )
    args = parser.parse_args(argv)
    outputs = build_outputs()
    if args.check:
        stale = [
            str(path.relative_to(ROOT))
            for path, expected in outputs.items()
            if not path.exists() or path.read_bytes() != expected
        ]
        if stale:
            print(f"stale generated artifact(s): {', '.join(stale)}", file=sys.stderr)
            return 1
        print(f"generated artifacts current: {len(outputs)}")
        return 0

    GENERATED_DIR.mkdir(exist_ok=True)
    for path, content in outputs.items():
        path.write_bytes(content)
        print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
