import { createMcpHandler } from "agents/mcp";

import { createPublicDataServer } from "./server.ts";
import { serviceInfo } from "./core.ts";

export default {
  async fetch(
    request: Request,
    env: unknown,
    context: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json(serviceInfo(), {
        headers: {
          "cache-control": "public, max-age=300",
        },
      });
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok", ...serviceInfo() });
    }
    const server = createPublicDataServer();
    return createMcpHandler(server, { route: "/mcp" })(request, env, context);
  },
} satisfies ExportedHandler;
