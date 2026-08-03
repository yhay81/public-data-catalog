import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { createPublicDataServer } from "../../src/server.ts";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const recipeSchema = JSON.parse(readFileSync("recipe.schema.json", "utf8"));
const receiptSchema = JSON.parse(readFileSync("receipt.schema.json", "utf8"));
const validateRecipe = ajv.compile(recipeSchema);
const validateReceipt = ajv.compile(receiptSchema);

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

function sortedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortedJson(child)]),
    );
  }
  return value;
}

function sha256Json(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(sortedJson(value))).digest("hex")}`;
}

async function createTestClient(fetchImpl?: typeof fetch) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createPublicDataServer({ fetchImpl });
  const client = new Client({ name: "public-data-catalog-tests", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test("the server exposes exactly the small reviewed tool surface", async () => {
  const { client, server } = await createTestClient();
  try {
    const response = await client.listTools();
    assert.deepEqual(
      response.tools.map((tool) => tool.name).sort(),
      ["execute", "search_data", "verify"],
    );
    for (const tool of response.tools) {
      assert.ok(tool.outputSchema, `${tool.name} should declare an output schema`);
    }
  } finally {
    await client.close();
    await server.close();
  }
});

test("all committed recipes satisfy the published JSON Schema", () => {
  for (const filename of readdirSync("recipes").filter((name) => name.endsWith(".json"))) {
    const recipe = JSON.parse(readFileSync(`recipes/${filename}`, "utf8"));
    assert.equal(
      validateRecipe(recipe),
      true,
      `${filename}: ${ajv.errorsText(validateRecipe.errors)}`,
    );
  }
});

test("search_data returns ranked live public-data candidates", async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "data.e-gov.go.jp") {
      return Response.json({
        success: true,
        result: {
          results: [
            {
              name: "population-table",
              title: "都道府県別の人口推移",
              notes: "都道府県別の人口を時系列で確認できるデータです。",
              organization: { title: "総務省" },
              tags: [{ name: "人口" }],
              groups: [{ display_name: "人口・世帯" }],
              resources: [
                { format: "XLSX", url: "https://example.go.jp/population.xlsx" },
              ],
              metadata_modified: "2026-07-01T00:00:00Z",
            },
          ],
        },
      });
    }
    return Response.json({
      GET_META_INDICATOR_INF: {
        RESULT: { status: "0" },
        METADATA_INF: { CLASS_INF: { CLASS_OBJ: [] } },
      },
    });
  };
  const { client, server } = await createTestClient(fakeFetch);
  try {
    const response = await client.callTool({
      name: "search_data",
      arguments: { query: "都道府県別の人口推移" },
    });
    assert.equal(response.isError, undefined);
    const payload = response.structuredContent as {
      total: number;
      results: Array<{ id: string; publisher: string }>;
    };
    assert.equal(payload.total, 1);
    assert.equal(payload.results[0]?.id, "egov:population-table");
    assert.equal(payload.results[0]?.publisher, "総務省");
  } finally {
    await client.close();
    await server.close();
  }
});

test("execute binds a reviewed parameter and verify covers the full evidence envelope", async () => {
  let requestedUrl = "";
  const fakeFetch: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify(tokyoResponse()), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  };
  const { client, server } = await createTestClient(fakeFetch);
  try {
    const response = await client.callTool({
      name: "execute",
      arguments: {
        recipeId: "tokyo-population-by-year",
        parameters: { year: 2025 },
      },
    });
    assert.equal(response.isError, undefined);
    assert.match(requestedUrl, /[?&]Time=2025CY00(?:&|$)/u);
    const execution = response.structuredContent as Record<string, unknown>;
    assert.deepEqual(execution.parameters, { year: 2025 });
    assert.equal(
      (execution.results as { population: { value: number } }).population.value,
      14_246_219,
    );
    assert.equal(
      validateReceipt(execution.receipt),
      true,
      ajv.errorsText(validateReceipt.errors),
    );

    const verified = await client.callTool({
      name: "verify",
      arguments: { execution },
    });
    const verifiedPayload = verified.structuredContent as {
      valid: boolean;
      checks: Record<string, boolean>;
    };
    assert.equal(verifiedPayload.valid, true);
    assert.deepEqual(verifiedPayload.checks, {
      receipt_integrity: true,
      results_integrity: true,
      execution_status: true,
      contract_binding: true,
      parameters_binding: true,
      request_binding: true,
      provenance_binding: true,
      catalog_binding: true,
    });

    const unreviewedUrl = structuredClone(execution);
    const unreviewedReceipt = unreviewedUrl.receipt as Record<string, unknown>;
    (unreviewedReceipt.request as Record<string, unknown>).requested_url =
      "https://dashboard.e-stat.go.jp/api/unreviewed?Time=2025CY00";
    const { receipt_id: _oldReceiptId, ...unreviewedReceiptBody } = unreviewedReceipt;
    unreviewedReceipt.receipt_id = sha256Json(unreviewedReceiptBody);
    const unreviewedVerification = await client.callTool({
      name: "verify",
      arguments: { execution: unreviewedUrl },
    });
    const unreviewedPayload = unreviewedVerification.structuredContent as {
      valid: boolean;
      checks: Record<string, boolean>;
    };
    assert.equal(unreviewedPayload.valid, false);
    assert.equal(unreviewedPayload.checks.receipt_integrity, true);
    assert.equal(unreviewedPayload.checks.catalog_binding, false);

    const invalidReceipt = structuredClone(execution);
    const invalidReceiptRecord = invalidReceipt.receipt as Record<string, unknown>;
    (invalidReceiptRecord.request as Record<string, unknown>).response_sha256 = "not-a-digest";
    const { receipt_id: _invalidReceiptId, ...invalidReceiptBody } = invalidReceiptRecord;
    invalidReceiptRecord.receipt_id = sha256Json(invalidReceiptBody);
    const invalidVerification = await client.callTool({
      name: "verify",
      arguments: { execution: invalidReceipt },
    });
    assert.equal(invalidVerification.isError, true);

    const tamperCases: Array<[string, (candidate: Record<string, unknown>) => void]> = [
      [
        "results",
        (candidate) => {
          (candidate.results as { population: { value: number } }).population.value += 1;
        },
      ],
      ["status", (candidate) => { candidate.status = "unverified"; }],
      ["recipe", (candidate) => { candidate.recipe_id = "different-recipe"; }],
      ["parameters", (candidate) => { candidate.parameters = { year: 2024 }; }],
      ["request URL", (candidate) => { candidate.request_url = "https://example.com/"; }],
      ["retrieval time", (candidate) => { candidate.retrieved_at = "2020-01-01T00:00:00Z"; }],
      ["elapsed time", (candidate) => { candidate.elapsed_ms = 999; }],
      [
        "provenance",
        (candidate) => {
          (candidate.provenance as Record<string, unknown>).source_url = "https://example.com/";
        },
      ],
      ["question", (candidate) => { candidate.question = { ja: "別の質問", en: "Other" }; }],
      ["interpretation", (candidate) => { candidate.interpretation = ["注意事項なし"]; }],
    ];
    for (const [label, tamper] of tamperCases) {
      const candidate = structuredClone(execution);
      tamper(candidate);
      const tampered = await client.callTool({
        name: "verify",
        arguments: { execution: candidate },
      });
      assert.equal(
        (tampered.structuredContent as { valid: boolean }).valid,
        false,
        `${label} tampering should be detected`,
      );
    }
  } finally {
    await client.close();
    await server.close();
  }
});

test("execute rejects a response whose time code does not match the requested year", async () => {
  const wrongYear = tokyoResponse();
  wrongYear.GET_STATS.STATISTICAL_DATA.DATA_INF.DATA_OBJ[0]!.VALUE["@time"] = "2015CY00";
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify(wrongYear), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const { client, server } = await createTestClient(fakeFetch);
  try {
    const response = await client.callTool({
      name: "execute",
      arguments: {
        recipeId: "tokyo-population-by-year",
        parameters: { year: 2025 },
      },
    });
    assert.equal(response.isError, true);
    const content = response.content as Array<{ type: string; text?: string }>;
    assert.match(content[0]?.text ?? "", /2025CY00/u);
  } finally {
    await client.close();
    await server.close();
  }
});

test("timestamp transforms use the same millisecond precision as the Python runner", async () => {
  const document = {
    type: "FeatureCollection",
    features: [
      {
        id: "us6000m0xl",
        properties: {
          mag: 7.5,
          magType: "mww",
          time: 1_704_093_009_476,
          place: "2024 Noto Peninsula, Japan Earthquake",
        },
      },
    ],
  };
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify(document), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const { client, server } = await createTestClient(fakeFetch);
  try {
    const response = await client.callTool({
      name: "execute",
      arguments: { recipeId: "usgs-noto-earthquake-2024" },
    });
    assert.equal(response.isError, undefined);
    const execution = response.structuredContent as {
      results: Record<string, { value: unknown }>;
    };
    assert.equal(execution.results["occurred-at"]?.value, "2024-01-01T07:10:09.476Z");
  } finally {
    await client.close();
    await server.close();
  }
});

test("execute rejects parameters outside the reviewed range before fetching", async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    throw new Error("fetch should not be reached");
  };
  const { client, server } = await createTestClient(fakeFetch);
  try {
    const response = await client.callTool({
      name: "execute",
      arguments: {
        recipeId: "tokyo-population-by-year",
        parameters: { year: 2030 },
      },
    });
    assert.equal(response.isError, true);
    assert.equal(calls, 0);
  } finally {
    await client.close();
    await server.close();
  }
});
