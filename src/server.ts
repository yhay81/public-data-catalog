import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  ContractError,
  executeContract,
  verifyExecution,
} from "./core.ts";
import { searchPublicData } from "./search.ts";

const jsonObject = z.record(z.string(), z.unknown());

function toolResult(structuredContent: Record<string, unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredContent),
      },
    ],
    structuredContent,
  };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createPublicDataServer(options: { fetchImpl?: typeof fetch } = {}) {
  const server = new McpServer({
    name: "public-data-catalog",
    version: "0.6.0",
  });

  server.registerTool(
    "search_data",
    {
      title: "Search Japanese public datasets",
      description:
        "Search current metadata from e-Gov Data Portal and Statistics Dashboard, then return a short ranked list with publisher, formats, coverage, usage terms, and official links.",
      inputSchema: {
        query: z
          .string()
          .trim()
          .min(2)
          .max(80)
          .describe("What data to find, preferably in Japanese"),
        kind: z
          .enum(["all", "dataset", "statistics"])
          .default("all")
          .describe("Search all sources, downloadable datasets, or statistical series"),
        limit: z.number().int().min(1).max(20).default(10),
      },
      outputSchema: {
        status: z.literal("ok"),
        query: z.string(),
        interpreted_as: z.array(z.string()),
        searched_at: z.string(),
        results: z.array(z.unknown()),
        total: z.number().int().nonnegative(),
        available: jsonObject,
        sources: z.array(z.unknown()),
        note: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      try {
        return toolResult(await searchPublicData(input, options.fetchImpl));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "execute",
    {
      title: "Execute a reviewed retrieval contract",
      description:
        "Run one allowlisted, bounded HTTPS GET contract and return extracted values, provenance, and an integrity receipt.",
      inputSchema: {
        recipeId: z.string().trim().min(1).max(100),
        parameters: z
          .record(z.string().regex(/^[a-z0-9][a-z0-9-]+$/u), z.number().int())
          .optional(),
      },
      outputSchema: {
        status: z.literal("ok"),
        recipe_id: z.string(),
        contract_version: z.string(),
        question: jsonObject,
        parameters: jsonObject,
        retrieved_at: z.string(),
        elapsed_ms: z.number().int().nonnegative(),
        request_url: z.string(),
        results: jsonObject,
        interpretation: z.array(z.string()),
        provenance: jsonObject,
        receipt: jsonObject,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input) => {
      try {
        return toolResult(
          await executeContract(
            { recipeId: input.recipeId, parameters: input.parameters },
            options.fetchImpl,
          ),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "verify",
    {
      title: "Verify an execution receipt",
      description:
        "Check receipt and result hashes plus the execution envelope against the reviewed catalog. This detects later modification; it does not prove publisher authenticity or current freshness.",
      inputSchema: {
        execution: jsonObject,
      },
      outputSchema: {
        valid: z.boolean(),
        receipt_id: z.string(),
        checks: jsonObject,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ execution }) => {
      try {
        return toolResult(await verifyExecution(execution));
      } catch (error) {
        if (error instanceof ContractError) return toolError(error);
        return toolError(error);
      }
    },
  );

  return server;
}
