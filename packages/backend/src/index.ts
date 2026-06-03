import { serve } from "@hono/node-server";
import { createApp } from "./server.js";

const port = Number(process.env.PORT) || 8080;

const { app, stop } = await createApp();

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`LLM Proxy Gateway running on http://localhost:${port}`);
  console.log(`Available endpoints:`);
  console.log(`  GET    /health`);
  console.log(`  POST   /v1/chat/completions`);
  console.log(`  POST   /v1/messages`);
  console.log(`  POST   /v1/responses`);
  console.log(`  GET    /api/models`);
  console.log(`  GET    /api/providers`);
  console.log(`  GET    /api/auths`);
  console.log(`  POST   /api/auths/validate`);
  console.log(`  GET    /api/stats/dashboard`);
  console.log(`  GET    /api/stats/timeseries`);
  console.log(`  GET    /api/stats/models`);
  console.log(`  GET    /api/stats/providers`);
  console.log(`  GET    /api/stats/auths`);
  console.log(`  POST   /api/config/reload`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await stop();
  server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down...");
  await stop();
  server.close();
  process.exit(0);
});

export default app;
