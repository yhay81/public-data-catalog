import { createMcpHandler } from "agents/mcp";

import { createPublicDataServer } from "./server.ts";
import { serviceInfo } from "./core.ts";
import {
  listResearchTopics,
  ResearchInputError,
  researchStatistic,
} from "./research.ts";

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    context: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        status: "ok",
        ...serviceInfo(),
        research_topics: listResearchTopics().length,
      });
    }
    if (url.pathname === "/api/research") {
      if (request.method === "GET") {
        return Response.json({ topics: listResearchTopics() });
      }
      if (request.method !== "POST") {
        return Response.json(
          { status: "error", message: "POSTで調査内容を送信してください。" },
          { status: 405, headers: { Allow: "GET, POST" } },
        );
      }
      const contentLength = Number(request.headers.get("content-length") ?? "0");
      if (Number.isFinite(contentLength) && contentLength > 4096) {
        return Response.json(
          { status: "error", message: "入力が大きすぎます。" },
          { status: 413 },
        );
      }
      let input: unknown;
      try {
        const body = await request.text();
        if (new TextEncoder().encode(body).byteLength > 4096) {
          return Response.json(
            { status: "error", message: "入力が大きすぎます。" },
            { status: 413 },
          );
        }
        input = JSON.parse(body);
      } catch {
        return Response.json(
          { status: "error", message: "入力を読み取れませんでした。" },
          { status: 400 },
        );
      }
      try {
        return Response.json(await researchStatistic(input), {
          headers: { "Cache-Control": "no-store" },
        });
      } catch (error) {
        const inputError = error instanceof ResearchInputError;
        return Response.json(
          {
            status: "error",
            message: inputError
              ? error.message
              : "公式データを取得できませんでした。時間をおいて再度お試しください。",
          },
          { status: inputError ? 400 : 502 },
        );
      }
    }
    if (url.pathname === "/mcp") {
      const server = createPublicDataServer();
      return createMcpHandler(server, { route: "/mcp" })(request, env, context);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
