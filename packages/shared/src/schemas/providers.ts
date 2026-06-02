import { z } from "zod";
import { AuthSchema } from "./auths.js";

/**
 * Rate limit type discriminator
 */
export const RateLimitTypeSchema = z.enum([
  "weighted_requests",
  "concurrency",
  "tokens",
]);

export type RateLimitType = z.infer<typeof RateLimitTypeSchema>;

/**
 * Time period for rate limiting
 * - second/minute/hour/day: standard periods
 * - 5h: 5-hour window (for request counting)
 * - week: weekly window
 * - month: monthly window
 */
export const RateLimitPeriodSchema = z.enum([
  "second",
  "minute",
  "hour",
  "day",
  "5h",
  "week",
  "month",
]);

export type RateLimitPeriod = z.infer<typeof RateLimitPeriodSchema>;

/**
 * Weighted request-based rate limit: max N weighted requests per period
 * (actual count × model weight)
 */
export const WeightedRequestRateLimitSchema = z.object({
  type: z.literal("weighted_requests"),
  max: z.number().int().positive("Max weighted requests must be positive"),
  period: RateLimitPeriodSchema,
});

export type WeightedRequestRateLimit = z.infer<typeof WeightedRequestRateLimitSchema>;

/**
 * Concurrency-based rate limit: max N concurrent requests
 */
export const ConcurrencyRateLimitSchema = z.object({
  type: z.literal("concurrency"),
  max: z.number().int().positive("Max concurrency must be positive"),
});

export type ConcurrencyRateLimit = z.infer<typeof ConcurrencyRateLimitSchema>;

/**
 * Token-based rate limit: max N tokens per period
 */
export const TokenRateLimitSchema = z.object({
  type: z.literal("tokens"),
  max: z.number().int().positive("Max tokens must be positive"),
  period: RateLimitPeriodSchema,
});

export type TokenRateLimit = z.infer<typeof TokenRateLimitSchema>;

/**
 * Union of all rate limit types
 */
export const RateLimitSchema = z.discriminatedUnion("type", [
  WeightedRequestRateLimitSchema,
  ConcurrencyRateLimitSchema,
  TokenRateLimitSchema,
]);

export type RateLimit = z.infer<typeof RateLimitSchema>;

/**
 * Pricing model for provider billing
 * - per_request_weighted: pay per request based on model weight
 * - per_model_token: pay per token based on model-level pricing
 * - subscription: fixed monthly/yearly subscription with included requests
 */
export const PricingModelSchema = z.enum([
  "no_billing",
  "per_request_weighted",
  "per_model_token",
  "subscription",
]);

export type PricingModel = z.infer<typeof PricingModelSchema>;

/**
 * Subscription pricing configuration
 */
export const SubscriptionBillingTypeSchema = z.enum(["unlimited", "weighted_requests", "tokens"]);

export const SubscriptionConfigSchema = z.object({
  price: z.number().positive("Subscription price must be positive"),
  period: z.enum(["month", "year"]),
  billing_type: SubscriptionBillingTypeSchema.default("weighted_requests"),
  currency: z.string().default("USD"),
  // 按加权请求数
  included_requests: z.number().positive().optional(),
  overage_unit_price: z.number().nonnegative().optional(),
  // 按 token 量（超出用模型自身 input/output price）
  included_tokens: z.number().positive().optional(),
});

export type SubscriptionConfig = z.infer<typeof SubscriptionConfigSchema>;

/**
 * Provider model entry
 */
export const ProviderModelSchema = z.object({
  name: z.string().min(1, "Model name cannot be empty"),
  display_name: z.string().optional(),
  alias: z.string().optional(),
  enabled: z.boolean().default(true),
  max_tokens: z.number().int().positive().optional(),
  context_window: z.number().int().positive().optional(),
  weight: z.number().positive().optional(),
  input_price: z.number().nonnegative().optional(),
  output_price: z.number().nonnegative().optional(),
  input_price_per_million: z.number().nonnegative().optional(),
  output_price_per_million: z.number().nonnegative().optional(),
  cache_hit_price: z.number().nonnegative().optional(),
  cache_create_price: z.number().nonnegative().optional(),
});

export type ProviderModel = z.infer<typeof ProviderModelSchema>;

/**
 * Provider configuration
 * Auths are nested under each provider.
 */
export const ProviderSchema = z.object({
  id: z
    .string()
    .min(1, "Provider ID cannot be empty")
    .max(64, "Provider ID too long (max 64 chars)")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Provider ID can only contain letters, numbers, hyphens, and underscores",
    ),
  name: z.string().min(1, "Provider name cannot be empty").max(128),
  base_url: z.string().url("Base URL must be a valid URL"),
  models: z
    .array(ProviderModelSchema)
    .min(1, "At least one model is required"),
  auths: z.array(AuthSchema).default([]),
  rate_limits: z.array(RateLimitSchema).default([]),
  request_timeout_ms: z.number().int().min(0).default(60000),
  max_retries: z.number().int().min(0).default(3),
  enabled: z.boolean().default(true),
  pricing_model: PricingModelSchema.default("per_request_weighted"),
  unit_price: z.number().nonnegative().default(0.001),
  subscription: SubscriptionConfigSchema.optional(),
  currency: z.string().default("USD"),
  description: z.string().max(512).optional(),
  api_format: z
    .enum(["openai_chat", "anthropic_messages", "openai_responses"])
    .default("openai_chat"),
  headers: z.record(z.string(), z.string()).default({}),
  health_check_endpoint: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Provider = z.infer<typeof ProviderSchema>;

/**
 * Provider creation input
 */
export const CreateProviderSchema = ProviderSchema;

export type CreateProvider = z.infer<typeof CreateProviderSchema>;

/**
 * Provider update input (all fields optional)
 */
export const UpdateProviderSchema = ProviderSchema.partial();

export type UpdateProvider = z.infer<typeof UpdateProviderSchema>;

/**
 * Provider with database metadata
 */
export const ProviderWithMetaSchema = ProviderSchema.extend({
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_health_check: z.string().datetime().nullable().optional(),
  health_status: z.enum(["healthy", "unhealthy", "unknown"]).default("unknown"),
});

export type ProviderWithMeta = z.infer<typeof ProviderWithMetaSchema>;

/**
 * List providers response
 */
export const ProviderListSchema = z.array(ProviderSchema);

export type ProviderList = z.infer<typeof ProviderListSchema>;
