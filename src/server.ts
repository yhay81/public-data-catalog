import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  ContractError,
  executeContract,
  searchData,
  verifyExecution,
} from "./core.ts";

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
    version: "0.4.0",
  });

  server.registerTool(
    "search_data",
    {
      title: "Search reviewed public data",
      description:
        "Search source profiles and discover reviewed execution contracts. Returns metadata only and does not call an upstream API.",
      inputSchema: {
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe("Words in Japanese or English"),
        sourceId: z.string().trim().min(1).max(100).optional(),
        domain: z.string().trim().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      },
      outputSchema: {
        matches: z.array(z.unknown()),
        total: z.number().int().nonnegative(),
        catalog_version: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => toolResult(searchData(input)),
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
        "Recompute receipt and result hashes locally. This checks integrity, not whether the upstream source remains current.",
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
