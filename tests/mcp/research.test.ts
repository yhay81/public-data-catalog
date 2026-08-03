import assert from "node:assert/strict";
import test from "node:test";

import {
  listResearchTopics,
  ResearchInputError,
  researchStatistic,
} from "../../src/research.ts";

function tokyoResponse() {
  return {
    GET_STATS: {
      RESULT: { status: "0" },
      STATISTICAL_DATA: {
        RESULT_INF: { TOTAL_NUMBER: "1" },
        DATA_INF: {
          DATA_OBJ: [
            {
              VALUE: {
                $: "14246219",
                "@indicator": "0201010000000010000",
                "@regionCode": "13000",
                "@time": "2025CY00",
                "@isProvisional": "1",
              },
            },
          ],
        },
      },
    },
  };
}

test("research topics describe the five usable public research tasks", () => {
  const topics = listResearchTopics();
  assert.equal(topics.length, 5);
  assert.deepEqual(
    topics.map((topic) => topic.id),
    [
      "tokyo-population",
      "japan-unemployment",
      "world-bank-japan-population",
      "noto-earthquake",
      "egov-population-dataset",
    ],
  );
  assert.deepEqual(topics[0]?.parameters.year, {
    label: "調べる年",
    minimum: 2015,
    maximum: 2025,
    default: 2025,
  });
});

test("research returns a readable answer with source and verification", async () => {
  let requestedUrl = "";
  const fakeFetch: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify(tokyoResponse()), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  };

  const memo = await researchStatistic(
    { topic: "tokyo-population", year: 2025 },
    fakeFetch,
  );

  assert.match(requestedUrl, /[?&]Time=2025CY00(?:&|$)/u);
  assert.equal(memo.question, "2025年の東京都の総人口は？");
  assert.deepEqual(memo.primary[0], {
    id: "population",
    label: { ja: "総人口", en: "Total population" },
    value: 14_246_219,
    unit: "人",
  });
  assert.equal(memo.source.credit.startsWith("出典：統計ダッシュボード"), true);
  assert.equal(memo.verification.valid, true);
  assert.equal(memo.verification.source_checks, 6);
  assert.equal(memo.verification.integrity_checks, 8);
});

test("research rejects unsupported topics and years before fetching", async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    throw new Error("fetch should not be reached");
  };

  await assert.rejects(
    researchStatistic({ topic: "unknown" }, fakeFetch),
    ResearchInputError,
  );
  await assert.rejects(
    researchStatistic({ topic: "tokyo-population", year: 2030 }, fakeFetch),
    /2015年から2025年/u,
  );
  assert.equal(calls, 0);
});
