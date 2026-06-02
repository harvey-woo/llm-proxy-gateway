import { Hono } from "hono";
import type { ProviderPool } from "../pool.js";
import type { LoadedConfig } from "../config/loader.js";
import { transformRequest, transformResponse } from "../transformer.js";
import { logRequest } from "../stats.js";
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

  // Pin session for affinity on first selection
  if (sessionId) {
    pool.pinSession(sessionId, providerId, auth.key, realModel);
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
  upstreamBody.model = realModel;
  if (typeof upstreamBody.max_tokens === "number") {
    // Keep max_tokens as-is or adjust per provider
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
  // Can override client headers like user-agent for bypass scenarios
  if (model.headers) {
    Object.assign(requestHeaders, model.headers);
  }

  if (targetFormat === "anthropic_messages") {
    // Anthropic Messages API
    requestHeaders["x-api-key"] = auth.key;
    // Override with our protocol version (client may not set it)
    requestHeaders["anthropic-version"] = "2023-06-01";
  } else {
    // OpenAI-compatible APIs
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

    // Transform response back to source format if needed
    let finalResponseData = responseData;
    if (sourceFormat !== targetFormat) {
      finalResponseData = transformResponse(sourceFormat, targetFormat, responseData, realModel);
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

    // Log the error
    await logRequest({
      authKey: auth.key,
      providerId,
      modelAlias,
      realModel,
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
}

/**
 * Map API format to the upstream URL path.
 */
function formatToPath(format: string): string {
  switch (format) {
    case "anthropic_messages":
      return "/v1/messages";
    case "openai_responses":
      return "/v1/responses";
    case "openai_chat":
    default:
      return "/v1/chat/completions";
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
