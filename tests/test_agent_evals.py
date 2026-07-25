from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "evaluate_agent_traces.py"
SPEC = importlib.util.spec_from_file_location("agent_evals_under_test", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
agent_evals = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(agent_evals)


class AgentEvaluationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        document = json.loads(
            (ROOT / "evals" / "agent-scenarios.json").read_text(encoding="utf-8")
        )
        cls.scenarios = agent_evals.validate_scenario_set(document)
        cls.recipes = agent_evals._load_recipes()

    def test_set_covers_every_recipe_and_required_dimension(self) -> None:
        self.assertEqual(len(self.scenarios), 9)
        self.assertEqual(
            {scenario["dimension"] for scenario in self.scenarios},
            agent_evals.REQUIRED_DIMENSIONS,
        )
        self.assertEqual(
            {
                scenario["expected"]["recipe_id"]
                for scenario in self.scenarios
                if scenario["expected"]["outcome"] == "valid-result"
            },
            set(self.recipes),
        )

    def test_scorer_rejects_false_success_after_upstream_error(self) -> None:
        scenario = next(
            item for item in self.scenarios if item["id"] == "reject-upstream-error"
        )
        trace = {
            "scenario_id": scenario["id"],
            "calls": [
                {"tool": "search_data", "result": {}, "is_error": False},
                {
                    "tool": "execute",
                    "arguments": {
                        "recipeId": "tokyo-population-2023",
                        "parameters": {},
                    },
                    "result": {},
                    "is_error": True,
                },
            ],
            "answer": {"accepted": True},
        }
        result = agent_evals.score_trace(scenario, trace, self.recipes)
        self.assertFalse(result["passed"])
        self.assertIn(
            "agent accepted an execute failure as a result",
            result["failures"],
        )

    def test_scorer_accepts_rejection_of_tampered_evidence(self) -> None:
        scenario = next(
            item
            for item in self.scenarios
            if item["id"] == "detect-provenance-tampering"
        )
        trace = {
            "scenario_id": scenario["id"],
            "calls": [
                {
                    "tool": "verify",
                    "result": {"structuredContent": {"valid": False}},
                    "is_error": False,
                }
            ],
            "answer": {"accepted": False},
        }
        result = agent_evals.score_trace(scenario, trace, self.recipes)
        self.assertTrue(result["passed"])


if __name__ == "__main__":
    unittest.main()
