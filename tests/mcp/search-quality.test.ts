import assert from "node:assert/strict";
import test from "node:test";

import { searchPublicData } from "../../src/search.ts";

function response(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function emptyEgovPayload() {
  return { success: true, result: { count: 0, results: [] } };
}

function indicator(name: string, code: string, statName = "社会・人口統計体系") {
  return {
    "@name": name,
    "@code": code,
    details: { detail: [{ "@name": name, $: `${name}を示す公式統計です。` }] },
    CLASS: [
      {
        "@name": name,
        "@fromDate": "2000CY00",
        "@toDate": "9999CY00",
        "@statName": statName,
        "@unit": "件",
        cycle: { "@code": "3", "@name": "年" },
        RegionalRank: { "@code": "2", "@name": "全国（日本）" },
        IsSeasonal: { "@code": "1", "@name": "原数値" },
      },
    ],
  };
}

function dashboardPayload(indicators: ReturnType<typeof indicator>[]) {
  return {
    GET_META_INDICATOR_INF: {
      RESULT: { status: "0" },
      METADATA_INF: { CLASS_INF: { CLASS_OBJ: indicators } },
    },
  };
}

test("plain-language queries expand to official statistical terms", async () => {
  const cases = [
    {
      query: "観光客数",
      officialTerm: "延べ宿泊者数",
      title: "延べ宿泊者数（総数）",
      code: "1000000000000000001",
    },
    {
      query: "犯罪件数",
      officialTerm: "刑法犯認知件数",
      title: "刑法犯認知件数",
      code: "1000000000000000002",
    },
    {
      query: "市区町村別所得",
      officialTerm: "課税対象所得",
      title: "課税対象所得",
      code: "1000000000000000003",
    },
    {
      query: "CO2排出量",
      officialTerm: "温室効果ガス排出",
      title: "温室効果ガス排出量（総数）",
      code: "1000000000000000004",
    },
  ];

  for (const candidate of cases) {
    const requestedTerms: string[] = [];
    const fakeFetch: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "data.e-gov.go.jp") return response(emptyEgovPayload());
      const searchTerm = url.searchParams.get("SearchIndicatorWord") ?? "";
      requestedTerms.push(searchTerm);
      return response(
        dashboardPayload(
          searchTerm === candidate.officialTerm
            ? [indicator(candidate.title, candidate.code)]
            : [],
        ),
      );
    };

    const result = await searchPublicData({ query: candidate.query, limit: 6 }, fakeFetch);
    assert.equal(requestedTerms.includes(candidate.officialTerm), true);
    assert.equal(result.interpreted_as.includes(candidate.officialTerm), true);
    assert.equal(result.results[0]?.title, candidate.title);
  }
});

test("a headline index ranks above change-rate variants unless the query asks for a rate", async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "data.e-gov.go.jp") return response(emptyEgovPayload());
    return response(
      dashboardPayload([
        indicator(
          "（前年同月比）消費者物価指数（総合）2020年基準",
          "2000000000000000001",
          "消費者物価指数",
        ),
        indicator(
          "消費者物価指数（総合）2020年基準",
          "2000000000000000002",
          "消費者物価指数",
        ),
      ]),
    );
  };

  const result = await searchPublicData({ query: "消費者物価指数", limit: 6 }, fakeFetch);
  assert.equal(result.results[0]?.title, "消費者物価指数（総合）2020年基準");
});
