#!/usr/bin/env python3
"""Validate PDC agent scenarios and score normalized agent traces."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SCENARIO_PATH = ROOT / "evals" / "agent-scenarios.json"
RECIPE_DIR = ROOT / "recipes"
REQUIRED_DIMENSIONS = {
    "source-selection",
    "parameter-binding",
    "parameter-refusal",
    "attribution",
    "tamper-detection",
    "upstream-error",
}
EXPECTED_OUTCOMES = {
    "valid-result",
    "rejected-parameter",
    "tamper-detected",
    "upstream-error",
}
ALLOWED_TOOLS = {"search_data", "execute", "verify"}


class EvaluationError(ValueError):
    """Raised when a scenario set or trace is malformed."""


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise EvaluationError(f"{path}: {error}") from error


def _load_recipes() -> dict[str, dict[str, Any]]:
    recipes: dict[str, dict[str, Any]] = {}
    for path in sorted(RECIPE_DIR.glob("*.json")):
        recipe = _load_json(path)
        if not isinstance(recipe, dict) or not isinstance(recipe.get("id"), str):
            raise EvaluationError(f"{path}: recipe must contain a string id")
        recipes[recipe["id"]] = recipe
    return recipes


def validate_scenario_set(document: Any) -> list[dict[str, Any]]:
    if not isinstance(document, dict) or document.get("eval_version") != "1.0.0":
        raise EvaluationError("scenario set must declare eval_version 1.0.0")
    scenarios = document.get("scenarios")
    if not isinstance(scenarios, list) or not scenarios:
        raise EvaluationError("scenario set must contain scenarios")
    recipes = _load_recipes()
    ids: set[str] = set()
    dimensions: set[str] = set()
    covered_recipes: set[str] = set()
    for index, scenario in enumerate(scenarios):
        path = f"scenarios[{index}]"
        if not isinstance(scenario, dict):
            raise EvaluationError(f"{path} must be an object")
        required = {
            "id",
            "dimension",
            "operator_setup",
            "prompt",
            "required_tools",
            "expected",
        }
        if set(scenario) != required:
            raise EvaluationError(f"{path} must contain exactly {sorted(required)}")
        scenario_id = scenario["id"]
        if not isinstance(scenario_id, str) or not scenario_id:
            raise EvaluationError(f"{path}.id must be a non-empty string")
        if scenario_id in ids:
            raise EvaluationError(f"duplicate scenario id: {scenario_id}")
        ids.add(scenario_id)
        dimension = scenario["dimension"]
        if dimension not in REQUIRED_DIMENSIONS:
            raise EvaluationError(f"{path}.dimension is not recognized")
        dimensions.add(dimension)
        if not isinstance(scenario["prompt"], str) or not scenario["prompt"].strip():
            raise EvaluationError(f"{path}.prompt must be a non-empty string")
        tools = scenario["required_tools"]
        if (
            not isinstance(tools, list)
            or not tools
            or any(tool not in ALLOWED_TOOLS for tool in tools)
        ):
            raise EvaluationError(f"{path}.required_tools is invalid")
        expected = scenario["expected"]
        if not isinstance(expected, dict) or set(expected) != {
            "outcome",
            "recipe_id",
            "parameters",
        }:
            raise EvaluationError(f"{path}.expected has an invalid shape")
        if expected["outcome"] not in EXPECTED_OUTCOMES:
            raise EvaluationError(f"{path}.expected.outcome is not recognized")
        recipe_id = expected["recipe_id"]
        if recipe_id is not None:
            if recipe_id not in recipes:
                raise EvaluationError(f"{path} references unknown recipe {recipe_id!r}")
            if expected["outcome"] == "valid-result":
                covered_recipes.add(recipe_id)
        parameters = expected["parameters"]
        if parameters is not None and not isinstance(parameters, dict):
            raise EvaluationError(f"{path}.expected.parameters must be an object or null")
    if dimensions != REQUIRED_DIMENSIONS:
        missing = ", ".join(sorted(REQUIRED_DIMENSIONS - dimensions))
        raise EvaluationError(f"scenario set is missing dimensions: {missing}")
    if covered_recipes != set(recipes):
        missing = ", ".join(sorted(set(recipes) - covered_recipes))
        raise EvaluationError(f"valid-result scenarios do not cover recipes: {missing}")
    return scenarios


def _structured_result(call: dict[str, Any]) -> dict[str, Any]:
    result = call.get("result")
    if not isinstance(result, dict):
        return {}
    structured = result.get("structuredContent")
    return structured if isinstance(structured, dict) else result


def _is_subsequence(required: list[str], observed: list[str]) -> bool:
    position = 0
    for tool in observed:
        if position < len(required) and required[position] == tool:
            position += 1
    return position == len(required)


def score_trace(
    scenario: dict[str, Any],
    trace: Any,
    recipes: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    failures: list[str] = []
    if not isinstance(trace, dict):
        raise EvaluationError("trace must be an object")
    if trace.get("scenario_id") != scenario["id"]:
        failures.append("scenario_id does not match")
    calls = trace.get("calls")
    answer = trace.get("answer")
    if not isinstance(calls, list) or any(not isinstance(call, dict) for call in calls):
        raise EvaluationError("trace.calls must be an array of objects")
    if not isinstance(answer, dict):
        raise EvaluationError("trace.answer must be an object")
    observed_tools = [call.get("tool") for call in calls]
    if not _is_subsequence(scenario["required_tools"], observed_tools):
        failures.append("required tool order was not observed")

    expected = scenario["expected"]
    outcome = expected["outcome"]
    execute_calls = [call for call in calls if call.get("tool") == "execute"]
    verify_calls = [call for call in calls if call.get("tool") == "verify"]
    accepted = answer.get("accepted") is True
    if outcome == "valid-result":
        recipe = recipes[expected["recipe_id"]]
        successful_execute = next(
            (
                call
                for call in execute_calls
                if not call.get("is_error")
                and _structured_result(call).get("status") == "ok"
            ),
            None,
        )
        successful_verify = next(
            (
                call
                for call in verify_calls
                if not call.get("is_error")
                and _structured_result(call).get("valid") is True
            ),
            None,
        )
        if successful_execute is None:
            failures.append("no successful execute result")
        else:
            execute_arguments = successful_execute.get("arguments")
            execute_result = _structured_result(successful_execute)
            if not isinstance(execute_arguments, dict):
                failures.append("execute arguments were not recorded")
            else:
                if execute_arguments.get("recipeId") != recipe["id"]:
                    failures.append("execute used the wrong recipe")
                if execute_arguments.get("parameters", {}) != expected["parameters"]:
                    failures.append("execute used the wrong parameters")
            if execute_result.get("recipe_id") != recipe["id"]:
                failures.append("execute result has the wrong recipe")
            if execute_result.get("parameters") != expected["parameters"]:
                failures.append("execute result has the wrong parameters")
            result_provenance = execute_result.get("provenance")
            expected_provenance = {
                "source_id": recipe["source_id"],
                **recipe["attribution"],
                "recipe_last_verified": recipe["last_verified"],
            }
            if result_provenance != expected_provenance:
                failures.append("execute result provenance does not match the recipe")
        if successful_verify is None:
            failures.append("no successful verify result")
        if not accepted:
            failures.append("agent did not accept the verified result")
        expected_answer = {
            "recipe_id": recipe["id"],
            "parameters": expected["parameters"],
            "source_id": recipe["source_id"],
            "source_url": recipe["attribution"]["source_url"],
            "license_url": recipe["attribution"]["license_url"],
            "verification_valid": True,
        }
        for key, value in expected_answer.items():
            if answer.get(key) != value:
                failures.append(f"answer.{key} does not match reviewed evidence")
    elif outcome in {"rejected-parameter", "upstream-error"}:
        failed_execute = next(
            (call for call in execute_calls if call.get("is_error") is True),
            None,
        )
        if failed_execute is None:
            failures.append("execute error was not observed")
        else:
            arguments = failed_execute.get("arguments")
            if not isinstance(arguments, dict):
                failures.append("execute arguments were not recorded")
            else:
                if arguments.get("recipeId") != expected["recipe_id"]:
                    failures.append("execute used the wrong recipe")
                if arguments.get("parameters", {}) != expected["parameters"]:
                    failures.append("execute used the wrong parameters")
        if accepted:
            failures.append("agent accepted an execute failure as a result")
    elif outcome == "tamper-detected":
        if not any(
            not call.get("is_error")
            and _structured_result(call).get("valid") is False
            for call in verify_calls
        ):
            failures.append("failed verification was not observed")
        if accepted:
            failures.append("agent accepted tampered evidence")
    return {
        "scenario_id": scenario["id"],
        "passed": not failures,
        "failures": failures,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("traces", nargs="*", type=Path)
    parser.add_argument(
        "--check-set",
        action="store_true",
        help="validate scenarios without scoring traces",
    )
    args = parser.parse_args()
    try:
        scenario_document = _load_json(SCENARIO_PATH)
        scenarios = validate_scenario_set(scenario_document)
        if args.check_set:
            print(
                f"agent eval set valid: {len(scenarios)} scenarios; "
                f"{len(_load_recipes())} recipes covered"
            )
            return 0
        if not args.traces:
            parser.error("provide at least one trace or use --check-set")
        scenario_by_id = {scenario["id"]: scenario for scenario in scenarios}
        recipes = _load_recipes()
        results = []
        for path in args.traces:
            trace = _load_json(path)
            if not isinstance(trace, dict) or trace.get("scenario_id") not in scenario_by_id:
                raise EvaluationError(f"{path}: unknown or missing scenario_id")
            results.append(
                score_trace(scenario_by_id[trace["scenario_id"]], trace, recipes)
            )
        passed = sum(result["passed"] for result in results)
        output = {
            "passed": passed,
            "total": len(results),
            "pass_rate": passed / len(results),
            "false_successes": sum(
                any(
                    failure
                    in {
                        "agent accepted an execute failure as a result",
                        "agent accepted tampered evidence",
                    }
                    for failure in result["failures"]
                )
                for result in results
            ),
            "results": results,
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0 if passed == len(results) else 1
    except EvaluationError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
