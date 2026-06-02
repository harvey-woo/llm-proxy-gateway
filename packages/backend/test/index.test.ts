import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testClient } from "hono/testing";
import { createApp } from "../src/server.js";

describe("LLM Proxy Gateway API", () => {
  let appClient: ReturnType<typeof testClient>;

  beforeAll(async () => {
    const { app } = await createApp();
    appClient = testClient(app);
  });

  it("GET / returns status ok", async () => {
    const res = await appClient.$get();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: "ok", name: "llm-proxy-gateway" });
  });

  it("GET /health returns healthy", async () => {
    const res = await appClient.health.$get();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("status", "healthy");
    expect(json).toHaveProperty("uptime_seconds");
    expect(json).toHaveProperty("version", "0.1.0");
  });

  it("GET /api/models returns model list", async () => {
    const res = await appClient.api.models.$get();
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
    expect((json.data as unknown[]).length).toBeGreaterThan(0);
  });

  it("GET /api/models/:id returns a single model", async () => {
    const res = await appClient.api.models[":id"].$get({
      param: { id: "qwen3.6-plus" },
    });
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
  });

  it("GET /api/models/:id returns 404 for unknown model", async () => {
    const res = await appClient.api.models[":id"].$get({
      param: { id: "nonexistent-model" },
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/providers returns provider list", async () => {
    const res = await appClient.api.providers.$get();
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
    expect((json.data as unknown[]).length).toBeGreaterThan(0);
  });

  it("GET /api/providers/:id returns a single provider", async () => {
    const res = await appClient.api.providers[":id"].$get({
      param: { id: "aliyun" },
    });
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
  });

  it("GET /api/providers/:id/auths returns auth list for provider", async () => {
    const res = await appClient.api.providers[":id"].auths.$get({
      param: { id: "aliyun" },
    });
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
    expect((json.data as unknown[]).length).toBe(0); // auths stored in DB, not YAML
  });

  it("POST /api/auths/validate validates a key", async () => {
    const res = await appClient.api.auths.validate.$post({
      json: { key: "sk-mock-test-key" },
    });
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
    const data = json.data as Record<string, unknown>;
    expect(data).toHaveProperty("valid");
  });

  it("POST /api/auths/validate returns invalid for unknown key", async () => {
    const res = await appClient.api.auths.validate.$post({
      json: { key: "sk-nonexistent-key-999" },
    });
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    const data = json.data as Record<string, unknown>;
    expect(data).toHaveProperty("valid", false);
  });

  it("GET /api/stats/dashboard returns dashboard stats", async () => {
    const res = await appClient.api.stats.dashboard.$get();
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
  });

  it("GET /api/stats/timeseries returns time series stats", async () => {
    const res = await appClient.api.stats.timeseries.$get({
      query: { granularity: "hour" },
    });
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
  });

  it("GET /api/stats/models returns model stats", async () => {
    const res = await appClient.api.stats.models.$get();
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
  });

  it("GET /api/stats/providers returns provider stats", async () => {
    const res = await appClient.api.stats.providers.$get();
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
  });

  it("GET /api/stats/auths returns auth stats", async () => {
    const res = await appClient.api.stats.auths.$get();
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
  });
});
