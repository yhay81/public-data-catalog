import { createMcpHandler } from "agents/mcp";

import { createPublicDataServer } from "./server.ts";
import { serviceInfo } from "./core.ts";

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
      return Response.json({ status: "ok", ...serviceInfo() });
    }
    if (url.pathname === "/mcp") {
      const server = createPublicDataServer();
      return createMcpHandler(server, { route: "/mcp" })(request, env, context);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
