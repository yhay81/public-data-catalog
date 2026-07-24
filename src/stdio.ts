import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createPublicDataServer } from "./server.ts";

const server = createPublicDataServer();
const transport = new StdioServerTransport();

await server.connect(transport);
