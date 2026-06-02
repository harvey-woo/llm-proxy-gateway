import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import modelsRouter from "./routes/models.js";
import providersRouter from "./routes/providers.js";
import authsRouter from "./routes/auths.js";
import statsRouter from "./routes/stats.js";
import gatewayRouter from "./routes/gateway.js";
import ratesRouter from "./routes/rates.js";
import { mockDelay } from "./middleware.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());
app.use("/api/*", mockDelay);
app.use("/v1/*", mockDelay);

// Health check (no delay)
app.get("/health", (c) => c.json({ status: "healthy", uptime_seconds: process.uptime(), version: "0.1.0-mock" }));

// API routes
app.route("/api/models", modelsRouter);
app.route("/api/providers", providersRouter);
// Auth routes are mounted under /api/providers/:id/auths via the providers router
app.route("/api/stats", statsRouter);
app.route("/api/config/reload", gatewayRouter);

// Rates routes
app.route("/api/rates", ratesRouter);

// Gateway proxy routes (chat completions)
app.route("/", gatewayRouter);

// Start server
const port = Number(process.env.PORT) || 3001;
serve({ fetch: app.fetch, port }, () => {
  console.log(`Mock API server running on http://localhost:${port}`);
  console.log(`Available endpoints:`);
  console.log(`  GET    /health`);
  console.log(`  CRUD   /api/models`);
  console.log(`  CRUD   /api/providers`);
  console.log(`  GET    /api/providers/:id/auths`);
  console.log(`  GET    /api/stats/requests`);
  console.log(`  GET    /api/stats/tokens`);
  console.log(`  GET    /api/stats/dashboard`);
  console.log(`  POST   /api/config/reload`);
  console.log(`  CRUD   /api/rates`);
  console.log(`  POST   /v1/chat/completions (streaming + non-streaming)`);
});
