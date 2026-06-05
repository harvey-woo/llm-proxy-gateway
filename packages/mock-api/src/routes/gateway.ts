import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { providersStore, rateLimitTracker } from "../store.js";

const router = new Hono();

// ── Mock OAuth token refresh endpoint ──
// POST /oauth/token - 模拟 OAuth token 刷新
router.post("/oauth/token", async (c) => {
  const body = await c.req.parseBody();
  const grantType = body.grant_type as string;

  if (grantType === "refresh_token") {
    const oldToken = body.refresh_token as string;
    const newAccessToken = oldToken
      ? oldToken.replace("expired", "refreshed")
      : "test-refreshed-new-token";
    const newRefreshToken = oldToken ? oldToken : "mock-refresh-token";

    // Update the provider store so subsequent requests use the new key
    for (const [, provider] of providersStore) {
      for (const auth of provider.auths ?? []) {
        if (auth.key?.startsWith("test-expired-")) {
          auth.key = newAccessToken;
          break;
        }
      }
    }

    return c.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      id_token: "eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.test",
      expires_in: 3600,
      token_type: "Bearer",
    });
  }

  return c.json({ error: "unsupported_grant_type" }, 400);
});

// GET /health - Health check
router.get("/health", (c) => {
  return c.json({
    status: "healthy",
    uptime_seconds: process.uptime(),
    version: "0.1.0-mock",
  });
});

// POST /api/config/reload - Config reload (no-op in mock)
router.post("/config/reload", (c) => {
  return c.json({
    success: true,
    data: {
      models_count: 7,
      providers_count: 3,
      auths_count: Array.from(providersStore.values()).reduce((sum, p) => sum + (p.auths?.length || 0), 0),
      reloaded_at: new Date().toISOString(),
    },
  });
});

// POST /v1/chat/completions - Mock OpenAI Chat Completions
router.post("/v1/chat/completions", async (c) => {
  // Check auth header for rate limiting simulation
  const authHeader = c.req.header("Authorization") || "";
  const apiKey = authHeader.replace("Bearer ", "").replace("sk-", "");

  // ── OAuth 过期测试 ──
  // 如果 Bearer token 以 "test-expired-" 开头，模拟上游返回 401
  // (不依赖 providersStore 查找，直接检查请求头)
  const bearerToken = authHeader.replace("Bearer ", "").trim();
  if (bearerToken.startsWith("test-expired-")) {
    return c.json(
      {
        error: {
          message: "Token expired or invalid",
          type: "authentication_error",
          code: "token_expired",
        },
      },
      401,
    );
  }

  // Find auths from providersStore
  let foundAuth = null;
  let providerId = "";
  for (const [pid, p] of providersStore) {
    const a = p.auths?.find((auth) => auth.key === bearerToken);
    if (a) {
      foundAuth = a;
      providerId = pid;
      break;
    }
  }

  if (foundAuth && foundAuth.key === "sk-rat...y-99") {
    // Track requests for this key
    const timestamps = rateLimitTracker.get(foundAuth.key) ?? [];
    const now = Date.now();
    recent.push(now);
    rateLimitTracker.set(foundAuth.key, recent);

    // After 10 requests in 60s, return 429
    if (recent.length > 10) {
      return c.json({
        error: {
          message: "Rate limit exceeded. Max 10 requests per minute for this key.",
          type: "rate_limit_error",
          param: null,
          code: "rate_limit_exceeded",
        },
      }, 429);
    }
  }

  const body = await c.req.json();
  const modelName = body.model ?? "gpt-4o";
  const isStream = body.stream === true;

  if (isStream) {
    // Streaming response
    const chunks = [
      { content: "Hello" },
      { content: "!" },
      { content: " " },
      { content: "I" },
      { content: "'m" },
      { content: " a" },
      { content: " mock" },
      { content: " AI" },
      { content: " assistant" },
      { content: "." },
      { content: " How" },
      { content: " can" },
      { content: " I" },
      { content: " help" },
      { content: " you" },
      { content: " today" },
      { content: "?" },
    ];

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        for (const chunk of chunks) {
          await new Promise((r) => setTimeout(r, 80));
          const data = JSON.stringify({
            id: "chatcmpl-mock-" + randomUUID().substring(0, 8),
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: chunk.content },
                finish_reason: null as string | null,
              },
            ],
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        // Final chunk with finish_reason and usage
        const finalData = JSON.stringify({
          id: "chatcmpl-mock-" + randomUUID().substring(0, 8),
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: modelName,
          choices: [
            {
              index: 0,
              delta: { content: null },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 17,
            total_tokens: 29,
          },
        });
        controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return c.newResponse(stream, 200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
  }

  // Non-streaming response
  return c.json({
    id: "chatcmpl-mock-" + randomUUID().substring(0, 20),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: modelName,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "Hello! I'm a mock AI assistant. This response was generated by the mock API server for testing purposes. How can I help you today?",
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 12,
      completion_tokens: 32,
      total_tokens: 44,
      prompt_tokens_details: {
        cached_tokens: 0,
      },
    },
    system_fingerprint: "fp_mock_12345",
  });
});

export default router;
