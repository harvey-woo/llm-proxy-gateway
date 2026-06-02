import { randomUUID } from "node:crypto";
import type {
  ModelAliasWithMeta,
  ProviderWithMeta,
  AuthWithMeta,
} from "@llm-proxy/shared/schemas";

// ============================================================
// In-memory storage with seed data
// ============================================================

export const modelsStore: Map<string, ModelAliasWithMeta> = new Map();
export const providersStore: Map<string, ProviderWithMeta> = new Map();

// Rate-limiting tracking: auth key -> timestamps of recent requests
export const rateLimitTracker: Map<string, number[]> = new Map();

const now = new Date().toISOString();

// Seed data
export function seedData() {
  // --- Auths (nested under providers) ---
  const a1: AuthWithMeta = {
    id: randomUUID(),
    key: "sk-adm...9i0j",
    name: "Admin Key",
    created_at: now,
    updated_at: now,
    last_used_at: now,
    total_requests: 8742,
    is_rate_limited: false,
  };

  const a2: AuthWithMeta = {
    id: randomUUID(),
    key: "sk-use...89jk",
    name: "Developer Team Key",
    created_at: now,
    updated_at: now,
    last_used_at: now,
    total_requests: 3210,
    is_rate_limited: false,
  };

  const a3: AuthWithMeta = {
    id: randomUUID(),
    key: "sk-rea...f456",
    name: "Analytics Dashboard",
    created_at: now,
    updated_at: now,
    last_used_at: now,
    total_requests: 1502,
    is_rate_limited: false,
  };

  const a4: AuthWithMeta = {
    id: randomUUID(),
    key: "sk-sus...5678",
    name: "Legacy App Key",
    created_at: now,
    updated_at: now,
    total_requests: 998,
    is_rate_limited: false,
  };

  const a5: AuthWithMeta = {
    id: randomUUID(),
    key: "sk-rat...y-99",
    name: "Rate Limit Test Key",
    created_at: now,
    updated_at: now,
    last_used_at: now,
    total_requests: 2300,
    is_rate_limited: true,
    limited_by: "weighted_requests/5h",
  };

  // --- Providers ---
  const p1: ProviderWithMeta = {
    id: "provider_a",
    name: "OpenAI",
    base_url: "https://api.openai.com/v1",
    models: [
      { name: "gpt-4o", display_name: "GPT-4o", alias: "gpt-4o", enabled: true, weight: 2, context_window: 128000, input_price_per_million: 2.5, output_price_per_million: 10 },
      { name: "gpt-4o-mini", display_name: "GPT-4o Mini", alias: "gpt-4o-mini", enabled: true, weight: 1, context_window: 128000, input_price_per_million: 0.15, output_price_per_million: 0.6 },
    ],
    auths: [a1, a2],
    rate_limits: [
      { type: "weighted_requests", max: 100, period: "minute" },
      { type: "tokens", max: 200000, period: "minute" },
    ],
    request_timeout_ms: 60000,
    max_retries: 3,
    enabled: true,
    pricing_model: "per_request_weighted",
    unit_price: 0.001,
    currency: "USD",
    health_status: "healthy",
    last_health_check: now,
    created_at: now,
    updated_at: now,
  };

  const p2: ProviderWithMeta = {
    id: "provider_b",
    name: "Anthropic",
    base_url: "https://api.anthropic.com",
    models: [
      { name: "claude-sonnet-4-20250514", display_name: "Claude Sonnet 4", alias: "claude-sonnet", enabled: true, weight: 1, context_window: 200000, input_price_per_million: 3, output_price_per_million: 15 },
      { name: "claude-opus-4-20250514", display_name: "Claude Opus 4", alias: "claude-opus", enabled: true, weight: 1, context_window: 200000, input_price_per_million: 15, output_price_per_million: 75 },
      { name: "claude-haiku-3-5", display_name: "Claude Haiku 3.5", alias: "claude-haiku", enabled: false, weight: 1, context_window: 100000, input_price_per_million: 0.8, output_price_per_million: 4 },
    ],
    auths: [a3],
    rate_limits: [
      { type: "concurrency", max: 10 },
    ],
    request_timeout_ms: 120000,
    max_retries: 2,
    enabled: true,
    pricing_model: "per_request_weighted",
    unit_price: 0.001,
    currency: "USD",
    health_status: "healthy",
    last_health_check: now,
    created_at: now,
    updated_at: now,
  };

  const p3: ProviderWithMeta = {
    id: "provider_c",
    name: "Google Vertex AI",
    base_url: "https://us-central1-aiplatform.googleapis.com/v1",
    models: [
      { name: "gemini-2.5-pro", display_name: "Gemini 2.5 Pro", alias: "gemini-pro", enabled: true, weight: 2, context_window: 1000000, input_price_per_million: 1.25, output_price_per_million: 5 },
      { name: "gemini-2.0-flash", display_name: "Gemini 2.0 Flash", alias: "gemini-flash", enabled: true, weight: 1, context_window: 1000000, input_price_per_million: 0.1, output_price_per_million: 0.4 },
    ],
    auths: [a4, a5],
    rate_limits: [
      { type: "weighted_requests", max: 60, period: "minute" },
    ],
    request_timeout_ms: 60000,
    max_retries: 3,
    enabled: true,
    pricing_model: "subscription",
    unit_price: 0.001,
    currency: "USD",
    subscription: {
      price: 100,
      period: "month",
      billing_type: "weighted_requests",
      included_requests: 10000,
      overage_unit_price: 0.002,
    },
    health_status: "unknown",
    last_health_check: null,
    created_at: now,
    updated_at: now,
  };

  providersStore.set(p1.id, p1);
  providersStore.set(p2.id, p2);
  providersStore.set(p3.id, p3);

  // --- Model Aliases ---
  const m1: ModelAliasWithMeta = {
    id: randomUUID(),
    alias: "chat-model",
    strategy: "proportional",
    models: [
      { provider_id: "provider_a", model_name: "gpt-4o" },
      { provider_id: "provider_a", model_name: "gpt-4o-mini" },
    ],
    enabled: true,
    queue_timeout: 30000,
    description: "Default chat model routing",
    created_at: now,
    updated_at: now,
  };

  const m2: ModelAliasWithMeta = {
    id: randomUUID(),
    alias: "fast-model",
    strategy: "priority",
    models: [
      { provider_id: "provider_a", model_name: "gpt-4o-mini" },
    ],
    enabled: true,
    queue_timeout: 30000,
    description: "Fast and cheap model for simple queries",
    created_at: now,
    updated_at: now,
  };

  const m3: ModelAliasWithMeta = {
    id: randomUUID(),
    alias: "smart-model",
    strategy: "proportional",
    models: [
      { provider_id: "provider_b", model_name: "claude-sonnet-4-20250514" },
    ],
    enabled: true,
    queue_timeout: 30000,
    description: "High-reasoning model for complex tasks",
    created_at: now,
    updated_at: now,
  };

  const m4: ModelAliasWithMeta = {
    id: randomUUID(),
    alias: "embedding-model",
    strategy: "proportional",
    models: [
      { provider_id: "provider_a", model_name: "text-embedding-3-small" },
    ],
    enabled: true,
    queue_timeout: 30000,
    description: "Text embedding model",
    created_at: now,
    updated_at: now,
  };

  const m5: ModelAliasWithMeta = {
    id: randomUUID(),
    alias: "vision-model",
    strategy: "proportional",
    models: [
      { provider_id: "provider_a", model_name: "gpt-4o" },
    ],
    enabled: true,
    queue_timeout: 30000,
    description: "Multi-modal vision model",
    created_at: now,
    updated_at: now,
  };

  const m6: ModelAliasWithMeta = {
    id: randomUUID(),
    alias: "coding-model",
    strategy: "priority",
    models: [
      { provider_id: "provider_b", model_name: "claude-opus-4-20250514" },
    ],
    enabled: true,
    queue_timeout: 30000,
    description: "Code generation specialist",
    created_at: now,
    updated_at: now,
  };

  const m7: ModelAliasWithMeta = {
    id: randomUUID(),
    alias: "fallback-model",
    strategy: "fallback",
    models: [
      { provider_id: "provider_a", model_name: "gpt-4o-mini" },
      { provider_id: "provider_b", model_name: "claude-haiku-3-5" },
    ],
    enabled: false,
    queue_timeout: 30000,
    description: "Disabled fallback model",
    created_at: now,
    updated_at: now,
  };

  modelsStore.set(m1.id, m1);
  modelsStore.set(m2.id, m2);
  modelsStore.set(m3.id, m3);
  modelsStore.set(m4.id, m4);
  modelsStore.set(m5.id, m5);
  modelsStore.set(m6.id, m6);
  modelsStore.set(m7.id, m7);
}

// Call seed on module load
seedData();
