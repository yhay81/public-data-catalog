from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "recipe_tool.py"
SPEC = importlib.util.spec_from_file_location("recipe_tool_under_test", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
recipe_tool = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(recipe_tool)


class RecipeDocumentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.recipes = recipe_tool.load_recipes()

    def test_expected_initial_recipes_are_present(self) -> None:
        self.assertEqual(
            set(self.recipes),
            {
                "egov-population-dataset-search",
                "japan-unemployment-rate-2023",
                "tokyo-population-2023",
                "tokyo-population-by-year",
                "usgs-noto-earthquake-2024",
                "world-bank-japan-population-2023",
            },
        )

    def test_all_recipes_use_get_and_https(self) -> None:
        for recipe in self.recipes.values():
            with self.subTest(recipe=recipe["id"]):
                self.assertEqual(recipe["request"]["method"], "GET")
                self.assertTrue(recipe["request"]["url"].startswith("https://"))

    def test_secret_like_query_key_is_rejected(self) -> None:
        recipe = copy.deepcopy(self.recipes["tokyo-population-2023"])
        recipe["request"]["url"] += "&api_key=not-a-real-secret"
        with self.assertRaisesRegex(recipe_tool.RecipeError, "secret-like"):
            recipe_tool.validate_recipe_document(recipe)

    def test_non_https_url_is_rejected(self) -> None:
        recipe = copy.deepcopy(self.recipes["tokyo-population-2023"])
        recipe["request"]["url"] = recipe["request"]["url"].replace("https://", "http://", 1)
        with self.assertRaisesRegex(recipe_tool.RecipeError, "must use HTTPS"):
            recipe_tool.validate_recipe_document(recipe)

    def test_unknown_field_is_rejected(self) -> None:
        recipe = copy.deepcopy(self.recipes["tokyo-population-2023"])
        recipe["unexpected"] = True
        with self.assertRaisesRegex(recipe_tool.RecipeError, "unknown field"):
            recipe_tool.validate_recipe_document(recipe)

    def test_wrong_schema_reference_is_rejected(self) -> None:
        recipe = copy.deepcopy(self.recipes["tokyo-population-2023"])
        recipe["$schema"] = "https://example.com/unreviewed-schema.json"
        with self.assertRaisesRegex(recipe_tool.RecipeError, r"\$schema"):
            recipe_tool.validate_recipe_document(recipe)

    def test_private_host_is_rejected(self) -> None:
        recipe = copy.deepcopy(self.recipes["tokyo-population-2023"])
        recipe["request"]["url"] = "https://127.0.0.1/data"
        recipe["request"]["allowed_hosts"] = ["127.0.0.1"]
        with self.assertRaisesRegex(recipe_tool.RecipeError, "not a global address"):
            recipe_tool.validate_recipe_document(recipe)

    def test_header_line_break_is_rejected(self) -> None:
        recipe = copy.deepcopy(self.recipes["tokyo-population-2023"])
        recipe["request"]["headers"]["Accept"] = "application/json\r\nX-Injected: yes"
        with self.assertRaisesRegex(recipe_tool.RecipeError, "line breaks"):
            recipe_tool.validate_recipe_document(recipe)

    def test_non_https_attribution_is_rejected(self) -> None:
        recipe = copy.deepcopy(self.recipes["tokyo-population-2023"])
        recipe["attribution"]["source_url"] = "http://example.com/source"
        with self.assertRaisesRegex(recipe_tool.RecipeError, "absolute HTTPS URL"):
            recipe_tool.validate_recipe_document(recipe)

    def test_secret_like_attribution_query_is_rejected(self) -> None:
        recipe = copy.deepcopy(self.recipes["tokyo-population-2023"])
        recipe["attribution"]["source_url"] += "&token=not-a-real-secret"
        with self.assertRaisesRegex(recipe_tool.RecipeError, "secret-like"):
            recipe_tool.validate_recipe_document(recipe)

    def test_non_default_attribution_port_is_rejected(self) -> None:
        recipe = copy.deepcopy(self.recipes["tokyo-population-2023"])
        recipe["attribution"]["source_url"] = "https://dashboard.e-stat.go.jp:8443/"
        with self.assertRaisesRegex(recipe_tool.RecipeError, "default HTTPS port"):
            recipe_tool.validate_recipe_document(recipe)

    def test_malformed_request_port_is_rejected_cleanly(self) -> None:
        recipe = copy.deepcopy(self.recipes["tokyo-population-2023"])
        recipe["request"]["url"] = "https://dashboard.e-stat.go.jp:not-a-port/"
        with self.assertRaisesRegex(recipe_tool.RecipeError, "invalid port"):
            recipe_tool.validate_recipe_document(recipe)

    def test_parameter_defaults_render_the_canonical_url(self) -> None:
        recipe = self.recipes["tokyo-population-by-year"]
        parameters = recipe_tool.resolve_parameters(recipe)
        self.assertEqual(parameters, {"year": 2023})
        self.assertEqual(recipe_tool.render_request_url(recipe, parameters), recipe["request"]["url"])

    def test_parameter_override_changes_only_the_reviewed_query_value(self) -> None:
        recipe = self.recipes["tokyo-population-by-year"]
        parameters = recipe_tool.resolve_parameters(recipe, {"year": "2025"})
        rendered = recipe_tool.render_request_url(recipe, parameters)
        self.assertIn("Time=2025CY00", rendered)
        self.assertEqual(rendered.replace("2025CY00", "2023CY00"), recipe["request"]["url"])

    def test_unknown_and_out_of_range_parameters_are_rejected(self) -> None:
        recipe = self.recipes["tokyo-population-by-year"]
        with self.assertRaisesRegex(recipe_tool.RecipeError, "unknown parameter"):
            recipe_tool.resolve_parameters(recipe, {"prefecture": 13})
        with self.assertRaisesRegex(recipe_tool.RecipeError, "2015 to 2025"):
            recipe_tool.resolve_parameters(recipe, {"year": 2026})

    def test_unsafe_binding_is_rejected(self) -> None:
        recipe = copy.deepcopy(self.recipes["tokyo-population-by-year"])
        recipe["request"]["bindings"][0]["format"] = "https://evil.example/{value}"
        with self.assertRaisesRegex(recipe_tool.RecipeError, "safe"):
            recipe_tool.validate_recipe_document(recipe)


class JsonPointerTests(unittest.TestCase):
    def test_resolves_objects_arrays_and_escaped_tokens(self) -> None:
        document = {"items": [{"a/b": {"~key": 42}}]}
        value = recipe_tool.resolve_json_pointer(document, "/items/0/a~1b/~0key")
        self.assertEqual(value, 42)

    def test_empty_pointer_returns_document(self) -> None:
        document = {"value": 1}
        self.assertIs(recipe_tool.resolve_json_pointer(document, ""), document)

    def test_invalid_pointer_raises_recipe_error(self) -> None:
        with self.assertRaises(recipe_tool.RecipeError):
            recipe_tool.resolve_json_pointer({"items": []}, "/items/0")

    def test_negative_array_index_is_rejected(self) -> None:
        with self.assertRaises(recipe_tool.RecipeError):
            recipe_tool.resolve_json_pointer({"items": ["last"]}, "/items/-1")


class ResultTests(unittest.TestCase):
    def test_supported_transforms(self) -> None:
        self.assertEqual(recipe_tool._transform_value("14", "integer"), 14)
        self.assertEqual(recipe_tool._transform_value("2.6", "number"), 2.6)
        self.assertEqual(
            recipe_tool._transform_value(1704093009476, "unix_milliseconds_to_iso8601"),
            "2024-01-01T07:10:09.476000Z",
        )

    def test_assertion_failure_is_descriptive(self) -> None:
        recipe = {
            "expect": {
                "assertions": [
                    {
                        "pointer": "/status",
                        "equals": "ok",
                    }
                ]
            }
        }
        with self.assertRaisesRegex(recipe_tool.RecipeError, "expected 'ok'"):
            recipe_tool._check_assertions(recipe, {"status": "failed"})

    def test_invalid_transform_value_is_descriptive(self) -> None:
        with self.assertRaisesRegex(recipe_tool.RecipeError, "could not apply 'integer'"):
            recipe_tool._transform_value("not-a-number", "integer")

    def test_text_result_keeps_value_provenance_and_license(self) -> None:
        result = {
            "question": {"ja": "東京都の人口は何人か。", "en": "What is Tokyo's population?"},
            "retrieved_at": "2026-07-24T12:00:00Z",
            "request_url": "https://example.go.jp/data?id=tokyo",
            "results": {
                "population": {
                    "label": {"ja": "総人口", "en": "Total population"},
                    "value": 14_086_000,
                    "unit": "人",
                }
            },
            "interpretation": ["確報値です。"],
            "provenance": {
                "source_id": "statistics-dashboard-api",
                "credit": "出典：統計ダッシュボード",
                "source_url": "https://dashboard.e-stat.go.jp/static/api?language=ja",
                "license_url": "https://dashboard.e-stat.go.jp/static/terms",
                "recipe_last_verified": "2026-07-24",
            },
        }
        text = recipe_tool._format_text_result(result)
        self.assertIn("総人口: 14086000 人", text)
        self.assertIn("情報源: statistics-dashboard-api", text)
        self.assertIn("出典：統計ダッシュボード", text)
        self.assertIn("https://dashboard.e-stat.go.jp/static/terms", text)
        self.assertIn("取得URL: https://example.go.jp/data?id=tokyo", text)

    def test_execution_receipt_detects_result_tampering(self) -> None:
        recipe = recipe_tool.load_recipes()["tokyo-population-by-year"]
        document = {
            "GET_STATS": {
                "RESULT": {"status": "0"},
                "STATISTICAL_DATA": {
                    "RESULT_INF": {"TOTAL_NUMBER": "1"},
                    "DATA_INF": {
                        "DATA_OBJ": [
                            {
                                "VALUE": {
                                    "$": "14246219",
                                    "@regionCode": "13000",
                                    "@time": "2025CY00",
                                    "@isProvisional": "1",
                                }
                            }
                        ]
                    },
                },
            }
        }
        with mock.patch.object(
            recipe_tool,
            "_fetch_json",
            return_value=(
                document,
                recipe["request"]["url"].replace("2023CY00", "2025CY00"),
                12,
                "sha256:" + "a" * 64,
            ),
        ):
            result = recipe_tool.execute_recipe(recipe, {"year": 2025})
        self.assertTrue(recipe_tool.verify_execution_result(result)["valid"])
        result["results"]["population"]["value"] += 1
        verification = recipe_tool.verify_execution_result(result)
        self.assertFalse(verification["valid"])
        self.assertFalse(verification["checks"]["results_integrity"])


class CommandLineTests(unittest.TestCase):
    def test_version_is_available_without_loading_recipes(self) -> None:
        completed = subprocess.run(
            [sys.executable, str(MODULE_PATH), "--version"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertIn(recipe_tool.VERSION, completed.stdout)

    def test_list_json_is_machine_readable(self) -> None:
        completed = subprocess.run(
            [sys.executable, str(MODULE_PATH), "list", "--json"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        payload = json.loads(completed.stdout)
        self.assertEqual(len(payload), 6)
        self.assertTrue(all("question" in item for item in payload))
        self.assertTrue(all("contract_version" in item for item in payload))

    def test_catalog_and_recipes_validate_together(self) -> None:
        completed = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate_catalog.py")],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertIn("catalog valid: 13 entries; recipes valid: 6", completed.stdout)

    def test_verify_reads_an_execution_result_from_standard_input(self) -> None:
        results = {"population": {"value": 14_246_219}}
        receipt_body = {"results_sha256": recipe_tool._canonical_json_sha256(results)}
        execution = {
            "results": results,
            "receipt": {
                **receipt_body,
                "receipt_id": recipe_tool._canonical_json_sha256(receipt_body),
            },
        }
        completed = subprocess.run(
            [sys.executable, str(MODULE_PATH), "verify", "-"],
            cwd=ROOT,
            check=True,
            input=json.dumps(execution),
            capture_output=True,
            text=True,
        )
        self.assertTrue(json.loads(completed.stdout)["valid"])


if __name__ == "__main__":
    unittest.main()
