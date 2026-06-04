import { Hono } from "hono";
import type { ProviderPool } from "../pool.js";
import type { LoadedConfig } from "../config/loader.js";
import { transformRequest, transformResponse } from "../transformer.js";
import { logRequest } from "../stats.js";
import { getDb } from "../db/database.js";
import type { Context } from "hono";

// ============================================================
// Session Affinity
// ============================================================
// When enabled (per model alias in models.yaml), the gateway
// detects session/correlation IDs from incoming request headers
// and pins subsequent requests from the same session to the
// same provider/auth.
//
// Configure per alias in models.yaml:
//   my-alias:
//     session_affinity: true   (default)
//     session_affinity: false  (disable)
// ============================================================

// Common session/correlation header names from AI coding agents
const SESSION_HEADERS = [
  "x-claude-code-session-id", // Claude Code
  "x-conversation-id",        // Generic / Hermes convention
  "x-session-id",             // Generic
  "x-request-id",             // OpenAI SDK, Azure, etc.
  "openai-conversation-id",   // OpenAI
  "x-correlation-id",         // General API convention
];

export function createGatewayRoutes(
  pool: ProviderPool,
  configRef: { current: LoadedConfig },
): Hono {
  const router = new Hono();

  // POST /v1/chat/completions
  router.post("/v1/chat/completions", async (c) => {
    return handleProxyRequest(c, pool, configRef, "openai_chat");
  });

  // POST /v1/messages
  router.post("/v1/messages", async (c) => {
    return handleProxyRequest(c, pool, configRef, "anthropic_messages");
  });

  // POST /v1/responses
  router.post("/v1/responses", async (c) => {
    return handleProxyRequest(c, pool, configRef, "openai_responses");
  });

  return router;
}

async function handleProxyRequest(
  c: Context,
  pool: ProviderPool,
  configRef: { current: LoadedConfig },
  sourceFormat: "openai_chat" | "anthropic_messages" | "openai_responses",
): Promise<Response> {
  const startTime = Date.now();

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        error: {
          message: "Invalid JSON body",
          type: "invalid_request_error",
          param: null,
          code: "invalid_body",
        },
      },
      400,
    );
  }

  const modelAlias = (body.model as string) ?? "";
  if (!modelAlias) {
    return c.json(
      {
        error: {
          message: "Model is required",
          type: "invalid_request_error",
          param: "model",
          code: "missing_model",
        },
      },
      400,
    );
  }

  // Save whether the original request was streaming (e.g. Claude Code sends stream: true)
  const wasStreaming = !!(body.stream as boolean);

  // Check if model alias exists
  const model = configRef.current.models.get(modelAlias);
  if (!model) {
    return c.json(
      {
        error: {
          message: `Unknown model alias: ${modelAlias}`,
          type: "invalid_request_error",
          param: "model",
          code: "unknown_model",
        },
      },
      404,
    );
  }

  // Estimate tokens for rate limiting (rough estimate from body)
  const estimatedTokens = estimateTokens(body);

  // Extract session ID from headers for affinity (per model alias)
  const sessionId = model.session_affinity !== false
    ? SESSION_HEADERS.map((h) => c.req.header(h)).find(Boolean)
    : undefined;

  // Try to select an auth entry
  let selection = pool.selectAuth(modelAlias, estimatedTokens, sessionId);

  // If no auth available, try the queue
  if (!selection) {
    // Find the longest queue_timeout among the models' providers
    const maxTimeout = model.models.length > 0
      ? Math.max(
          ...model.models.map((entry) => {
            const p = configRef.current.providers.get(entry.provider_id);
            return p?.request_timeout_ms ?? 30000;
          }),
        )
      : 30000;

    selection = await pool.enqueue(modelAlias, maxTimeout);
  }

  if (!selection) {
    const latencyMs = Date.now() - startTime;
    await logRequest({
      authKey: "unknown",
      providerId: "unknown",
      modelAlias,
      realModel: "unknown",
      format: sourceFormat,
      status: "rate_limited",
      inputTokens: 0,
      outputTokens: 0,
      cacheHitTokens: 0,
      cacheCreateTokens: 0,
      latencyMs,
      rateLimitedBy: "all_providers_busy",
    });

    return c.json(
      {
        error: {
          message: "All providers are currently at capacity. Please try again later.",
          type: "service_unavailable",
          param: null,
          code: "all_providers_busy",
        },
      },
      503,
    );
  }

  const { authEntry, realModel } = selection;
  const { auth, provider, providerId } = authEntry;

  // ── Failover loop: retry with different auth on upstream error ──
  const maxRetries = model.failover ? (provider.max_retries ?? 3) : 0;
  let lastError: { status: number; body: unknown } | null = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    const { auth, provider, providerId } = selection.authEntry;
    // Pin session for affinity on first selection (and re-pin on failover retry)
    if (sessionId) {
      pool.pinSession(sessionId, providerId, auth.key, selection.realModel);
    }

    // Record the request in rate limiter
    pool.getRateLimiter().recordRequest(auth.key, provider.rate_limits, estimatedTokens);

    // Determine target format from provider config
    const targetFormat = selection.authEntry.provider.api_format ?? sourceFormat;

    // Transform request if needed
    const transformResult = transformRequest(
      sourceFormat,
      targetFormat,
      body,
      provider.headers ?? {},
    );

    // Override model name with real upstream model
    const upstreamBody = transformResult.transformedBody as Record<string, unknown>;
    upstreamBody.model = selection.realModel;

    // When formats differ and original was streaming, force stream=false upstream
    // so we can transform the complete response and re-stream it in client format
    if (wasStreaming && sourceFormat !== targetFormat) {
      upstreamBody.stream = false;
    }

    // Add auth header and protocol headers based on API format
    const requestHeaders: Record<string, string> = {
      ...transformResult.headers,
      "Content-Type": "application/json",
    };

    // Forward client-controlled headers
    for (const h of ["user-agent", "accept", "accept-encoding"]) {
      const val = c.req.header(h);
      if (val) requestHeaders[h] = val;
    }

    // Apply alias-level headers last (highest priority)
    if (model.headers) {
      Object.assign(requestHeaders, model.headers);
    }

    if (targetFormat === "anthropic_messages") {
      requestHeaders["x-api-key"] = auth.key;
      requestHeaders["anthropic-version"] = "2023-06-01";
    } else {
      requestHeaders["Authorization"] = `Bearer ${auth.key}`;
    }

    try {
      // Determine upstream path based on target format (not client path)
      const upstreamPath = formatToPath(targetFormat);
      const upstreamUrl = `${provider.base_url}${upstreamPath}`;
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(upstreamBody),
      signal: AbortSignal.timeout(provider.request_timeout_ms),
    });

    const latencyMs = Date.now() - startTime;

    // Handle streaming responses
    if (upstreamResponse.headers.get("content-type")?.includes("text/event-stream")) {
      // Release concurrency for streaming
      pool.getRateLimiter().releaseConcurrency(auth.key, provider.rate_limits);

      // Log the streaming request (tokens will be unknown until stream ends)
      await logRequest({
        authKey: auth.key,
        providerId,
        modelAlias,
        realModel,
        format: sourceFormat,
        status: "success",
        inputTokens: 0,
        outputTokens: 0,
        cacheHitTokens: 0,
        cacheCreateTokens: 0,
        latencyMs,
      });

      // Pass through the stream
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: upstreamResponse.headers,
      });
    }

    // Non-streaming response
    const responseData = await upstreamResponse.json();

    // Release concurrency
    pool.getRateLimiter().releaseConcurrency(auth.key, provider.rate_limits);

    // If upstream returned an error — try failover or pass through
    if (!upstreamResponse.ok) {
      // Record failure for health tracking
      pool.recordFailure(auth.key);

      // ── OAuth token refresh on 401 ──
      // If upstream returned 401 and this auth has OAuth metadata with refresh_token,
      // refresh the token and retry with the same auth (only once per attempt).
      if (upstreamResponse.status === 401 && (auth as any).oauth_metadata) {
        const refreshed = await tryRefreshOAuthToken(auth, providerId, pool);
        if (refreshed) {
          // Update the auth key in selection for the retry
          selection.authEntry.auth.key = refreshed;
          console.log(`[gateway] OAuth token refreshed for ${auth.key.slice(0, 12)}..., retrying`);
          attempt++;
          continue;
        }
      }

      // Failover: retry with a different auth (non-streaming only)
      if (attempt < maxRetries) {
        // Unpin stale session
        if (sessionId) {
          pool.pinSession(sessionId, providerId, auth.key, selection.realModel);
        }
        // Try the next available auth, excluding the failed one
        const retrySelection = pool.selectAuth(modelAlias, estimatedTokens, sessionId, auth.key);
        if (retrySelection) {
          attempt++;
          selection = retrySelection;
          console.log(`[gateway] failover: retry attempt ${attempt}/${maxRetries} with provider ${retrySelection.authEntry.providerId}`);
          continue; // ⮌ retry with the new auth from loop top
        }
      }

      // No more retries — save last error and fall through to final error response
      lastError = { status: upstreamResponse.status, body: responseData };
      break;
    }

    // Record success for health tracking
    pool.recordSuccess(auth.key);
    if (!responseData) {
      throw new Error("Empty response from upstream");
    }

    // Transform response back to source format if needed
    let finalResponseData = responseData;
    if (sourceFormat !== targetFormat) {
      finalResponseData = transformResponse(sourceFormat, targetFormat, responseData, realModel);
    }

    // If original was streaming and formats differ (Anthropic→OpenAI), wrap as SSE
    if (wasStreaming && sourceFormat === "anthropic_messages") {
      const msg = finalResponseData as Record<string, unknown>;
      const msgId = (msg.id as string) ?? `msg_${Date.now()}`;
      const msgContent = (msg.content as Array<Record<string, unknown>>) ?? [{ type: "text", text: "" }];
      const msgModel = (msg.model as string) ?? realModel;
      const msgStop = (msg.stop_reason as string) ?? "end_turn";
      const msgUsage = (msg.usage as Record<string, number>) ?? { input_tokens: 0, output_tokens: 0 };
      const textBlock = msgContent.find((c) => c.type === "text");
      const text = (textBlock?.text as string) ?? "";

      const sseEvents = [
        `event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { id: msgId, type: "message", role: "assistant", content: [], model: msgModel, stop_reason: null, stop_sequence: null, usage: { input_tokens: msgUsage.input_tokens ?? 0, output_tokens: 0 } } })}\n\n`,
        `event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } })}\n\n`,
        `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`,
        `event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: msgStop, stop_sequence: null }, usage: { output_tokens: msgUsage.output_tokens ?? 0 } })}\n\n`,
        `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
      ];

      const encoder = new TextEncoder();
      const sseStream = new ReadableStream({
        start(controller) {
          for (const evt of sseEvents) {
            controller.enqueue(encoder.encode(evt));
          }
          controller.close();
        },
      });

      await logRequest({
        authKey: auth.key,
        providerId,
        modelAlias,
        realModel,
        format: sourceFormat,
        status: "success",
        inputTokens: msgUsage.input_tokens ?? 0,
        outputTokens: msgUsage.output_tokens ?? 0,
        cacheHitTokens: 0,
        cacheCreateTokens: 0,
        latencyMs,
      });

      return new Response(sseStream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Extract usage from response
    const usage = (finalResponseData as Record<string, unknown>).usage as
      | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; input_tokens?: number; output_tokens?: number }
      | undefined;

    const inputTokens = usage?.prompt_tokens ?? usage?.input_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? usage?.output_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;

    // Extract cache tokens from usage
    const cacheHitTokens = (usage as any)?.prompt_cache_hit_tokens ?? (usage as any)?.cache_read_input_tokens ?? 0;
    const cacheCreateTokens = (usage as any)?.cache_creation_input_tokens ?? 0;

    // Record actual usage
    if (totalTokens > 0) {
      pool.getRateLimiter().recordRequest(auth.key, provider.rate_limits, totalTokens);
    }

    // Log the request
    await logRequest({
      authKey: auth.key,
      providerId,
      modelAlias,
      realModel,
      format: sourceFormat,
      status: upstreamResponse.ok ? "success" : "error",
      inputTokens,
      outputTokens,
      cacheHitTokens,
      cacheCreateTokens,
      latencyMs,
      errorMessage: upstreamResponse.ok ? undefined : JSON.stringify(responseData),
    });

    // Return response to client
    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of upstreamResponse.headers.entries()) {
      responseHeaders[key] = value;
    }

    return new Response(JSON.stringify(finalResponseData), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // Release concurrency
    pool.getRateLimiter().releaseConcurrency(auth.key, provider.rate_limits);

    // Record failure for health tracking
    pool.recordFailure(auth.key);

    // Failover: retry with a different auth on network/parse error
    if (attempt < maxRetries) {
      if (sessionId) {
        pool.pinSession(sessionId, providerId, auth.key, selection.realModel);
      }
      const retrySelection = pool.selectAuth(modelAlias, estimatedTokens, sessionId, auth.key);
      if (retrySelection) {
        attempt++;
        selection = retrySelection;
        console.log(`[gateway] failover: retry attempt ${attempt}/${maxRetries} after network error`);
        continue;
      }
    }

    // No more retries — log and return error
    await logRequest({
      authKey: auth.key,
      providerId,
      modelAlias,
      realModel: selection.realModel,
      format: sourceFormat,
      status: "error",
      inputTokens: 0,
      outputTokens: 0,
      cacheHitTokens: 0,
      cacheCreateTokens: 0,
      latencyMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return c.json(
      {
        error: {
          message: `Upstream provider error: ${error instanceof Error ? error.message : "Unknown error"}`,
          type: "upstream_error",
          param: null,
          code: "upstream_error",
        },
      },
      502,
    );
  }

  // ── End of while loop — both success paths (return) and exhaustion paths (break) land here ──
  } // end while

  // If we break out of the loop with lastError, respond with the last upstream error
  if (lastError) {
    const { status, body } = lastError;
    await logRequest({
      authKey: "unknown",
      providerId: "unknown",
      modelAlias,
      realModel: "unknown",
      format: sourceFormat,
      status: "error",
      inputTokens: 0,
      outputTokens: 0,
      cacheHitTokens: 0,
      cacheCreateTokens: 0,
      latencyMs: Date.now() - startTime,
      errorMessage: JSON.stringify(body),
    });
    return c.json(body, status);
  }

  // Should never reach here
  return c.json({ error: { message: "Unexpected error in proxy request", code: "unexpected" } }, 500);
} // end handleProxyRequest

/**
 * Map API format to the upstream URL path.
 */
function formatToPath(format: string): string {
  switch (format) {
    case "anthropic_messages":
      return "/v1/messages";
    case "openai_responses":
      return "/responses";
    case "openai_chat":
    default:
      return "/chat/completions";
  }
}
// ── OAuth token refresh on 401 ──
// When upstream returns 401 and the auth has OAuth metadata with refresh_token,
// refresh the token, update DB and in-memory store, return new access_token.
async function tryRefreshOAuthToken(
  auth: { key: string; oauth_metadata?: string },
  providerId: string,
  pool: ProviderPool,
): Promise<string | null> {
  if (!auth.oauth_metadata) return null;

  let metadata: Record<string, string>;
  try {
    metadata = JSON.parse(auth.oauth_metadata) as Record<string, string>;
  } catch {
    return null;
  }

  const refreshToken = metadata.refresh_token;
  if (!refreshToken) return null;

  try {
    const response = await fetch("https://auth.openai.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: "app_EMoamEEZ73f0CkXaXp7hrann",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "openid profile email",
      }).toString(),
    });

    if (!response.ok) {
      console.warn(`[gateway] OAuth refresh failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (data.expires_in ?? 3600) * 1000);

    // Update metadata
    metadata.access_token = data.access_token;
    if (data.refresh_token) metadata.refresh_token = data.refresh_token;
    metadata.expires_at = expiresAt.toISOString();
    metadata.token_refreshed_at = now.toISOString();

    const metadataJson = JSON.stringify(metadata);

    // Update DB
    try {
      const db = await getDb();
      await db
        .updateTable("provider_auths")
        .set({
          key: data.access_token,
          metadata: metadataJson,
          updated_at: now.toISOString(),
        })
        .where("key", "=", auth.key)
        .execute();
    } catch (err) {
      console.warn("[gateway] Failed to update DB after OAuth refresh:", err);
    }

    // Update in-memory store (the pool's auth map)
    pool.updateAuthKey(auth.key, data.access_token, metadataJson);

    return data.access_token;
  } catch (err) {
    console.warn("[gateway] OAuth refresh network error:", err);
    return null;
  }
}
/**
 * Rough token estimation from request body.
 */
function estimateTokens(body: Record<string, unknown>): number {
  let total = 0;

  // Estimate from messages
  const messages = body.messages as Array<Record<string, unknown>> | undefined;
  if (messages) {
    for (const msg of messages) {
      const content = msg.content as string | undefined;
      if (content) {
        // Rough estimate: ~4 chars per token
        total += Math.ceil(content.length / 4);
      }
    }
  }

  // Estimate from input (Responses API)
  const input = body.input as string | Array<Record<string, unknown>> | undefined;
  if (typeof input === "string") {
    total += Math.ceil(input.length / 4);
  } else if (Array.isArray(input)) {
    for (const item of input) {
      const content = item.content as string | undefined;
      if (content) {
        total += Math.ceil(content.length / 4);
      }
    }
  }

  return total;
}
