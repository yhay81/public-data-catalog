import assert from "node:assert/strict";
import test from "node:test";

import {
  PublicDataSearchInputError,
  searchPublicData,
} from "../../src/search.ts";

function egovPayload() {
  return {
    success: true,
    result: {
      results: [
        {
          name: "paper",
          title: "人口問題に関する報告書",
          notes: "人口について論じた過去の報告書です。",
          organization: { title: "内閣府" },
          tags: [],
          groups: [],
          resources: [{ format: "PDF", url: "https://example.go.jp/paper.pdf" }],
          metadata_modified: "2023-06-01T00:00:00Z",
        },
        {
          name: "population",
          title: "都道府県別の人口推移",
          notes: "都道府県別の人口を年ごとに確認できるデータです。",
          organization: { title: "総務省" },
          tags: [{ name: "人口" }],
          groups: [{ display_name: "人口・世帯" }],
          resources: [
            { format: "XLSX", url: "https://example.go.jp/population.xlsx" },
            { format: "PDF", url: "https://example.go.jp/population.pdf" },
          ],
          temporal: "2015年から2025年",
          frequency_of_update: "1年",
          metadata_modified: "2026-07-01T00:00:00Z",
        },
      ],
    },
  };
}

function dashboardPayload() {
  return {
    GET_META_INDICATOR_INF: {
      RESULT: { status: "0" },
      METADATA_INF: {
        CLASS_INF: {
          CLASS_OBJ: [
            {
              "@name": "総人口（総数）",
              "@code": "0201010000000010000",
              details: {
                detail: [
                  {
                    "@name": "総人口",
                    $: "国勢調査を基準に、毎年の人口を算出したもの。",
                  },
                ],
              },
              CLASS: [
                {
                  "@name": "総人口（総数）",
                  "@fromDate": "1920CY00",
                  "@toDate": "9999CY00",
                  "@statName": "国勢調査／人口推計",
                  "@unit": "人",
                  cycle: { "@code": "3", "@name": "年" },
                  RegionalRank: { "@code": "2", "@name": "全国（日本）" },
                  IsSeasonal: { "@code": "1", "@name": "原数値" },
                },
              ],
            },
          ],
        },
      },
    },
  };
}

function response(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

test("search ranks reusable data above document-only results and combines official sources", async () => {
  const requested: URL[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url);
    return url.hostname === "data.e-gov.go.jp"
      ? response(egovPayload())
      : response(dashboardPayload());
  };

  const result = await searchPublicData(
    { query: "都道府県別の人口推移", limit: 10 },
    fakeFetch,
  );

  assert.equal(result.status, "ok");
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources.every((source) => source.status === "ok"), true);
  assert.equal(result.results.some((candidate) => candidate.id === "egov:population"), true);
  assert.equal(
    result.results.some((candidate) => candidate.id === "dashboard:0201010000000010000"),
    true,
  );
  const datasetResults = result.results.filter((candidate) => candidate.kind === "dataset");
  assert.equal(datasetResults[0]?.id, "egov:population");
  assert.deepEqual(datasetResults[0]?.formats, ["XLSX", "PDF"]);
  assert.equal(requested[0]?.searchParams.get("q"), "人口");
  assert.equal(requested[1]?.searchParams.get("SearchIndicatorWord"), "人口");
});

test("search still returns results when one official source is temporarily unavailable", async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "dashboard.e-stat.go.jp") throw new Error("temporary failure");
    return response(egovPayload());
  };

  const result = await searchPublicData({ query: "人口" }, fakeFetch);
  assert.equal(result.results.length > 0, true);
  assert.equal(
    result.sources.find((source) => source.id === "statistics-dashboard-api")?.status,
    "error",
  );
});

test("search validates user input before calling official sources", async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    throw new Error("fetch should not be reached");
  };

  await assert.rejects(
    searchPublicData({ query: "人" }, fakeFetch),
    PublicDataSearchInputError,
  );
  await assert.rejects(
    searchPublicData({ query: "人口", kind: "unknown" as "all" }, fakeFetch),
    PublicDataSearchInputError,
  );
  assert.equal(calls, 0);
});
