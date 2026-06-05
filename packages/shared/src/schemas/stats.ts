import { z } from "zod";

/**
 * Time range options for request stats (fixed periods)
 */
export const StatsRequestPeriodSchema = z.enum(["5h", "week", "month"]);

export type StatsRequestPeriod = z.infer<typeof StatsRequestPeriodSchema>;

/**
 * Time granularity for token stats
 */
export const StatsTokenGranularitySchema = z.enum(["hour", "day", "month"]);

export type StatsTokenGranularity = z.infer<typeof StatsTokenGranularitySchema>;

/**
 * Aggregated requests per period (by auth key)
 */
export const RequestsPerPeriodSchema = z.object({
  period: z.string(), // e.g. "5h", "week", "month"
  count: z.number().int().min(0),
  auth_key: z.string(),
  auth_name: z.string().optional(),
});

export type RequestsPerPeriod = z.infer<typeof RequestsPerPeriodSchema>;

/**
 * Aggregated tokens per time bucket (by auth key)
 */
export const TokensPerHourSchema = z.object({
  timestamp: z.string(), // ISO datetime
  auth_key: z.string(),
  auth_name: z.string().optional(),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  cache_tokens: z.number().int().min(0).default(0),
  total_tokens: z.number().int().min(0),
});

export type TokensPerHour = z.infer<typeof TokensPerHourSchema>;

/**
 * Per-auth key statistics (simplified, single dimension)
 */
export const AuthStatsSchema = z.object({
  key_id: z.string(),
  key_name: z.string().optional(),
  total_requests: z.number().int().min(0),
  successful_requests: z.number().int().min(0),
  failed_requests: z.number().int().min(0),
  rate_limited_requests: z.number().int().min(0),
  total_tokens: z.number().int().min(0),
  is_rate_limited: z.boolean().default(false),
});

export type AuthStats = z.infer<typeof AuthStatsSchema>;

// ============================================================
// Billing-model-sectioned dashboard types
// ============================================================

/**
 * Per-auth rate limit usage info (progress bar data)
 */
export const LimitInfoSchema = z.object({
  type: z.string(),
  period: z.string().optional(),
  used: z.number().min(0),
  max: z.number().min(0),
  remaining: z.number().min(0),
  usage_pct: z.number().min(0),
});

export type LimitInfo = z.infer<typeof LimitInfoSchema>;

/**
 * Auth info within a section row (for expandable rows)
 */
export const SectionAuthInfoSchema = z.object({
  auth_key: z.string(),
  auth_name: z.string().optional(),
  limits: z.array(LimitInfoSchema),
});

export type SectionAuthInfo = z.infer<typeof SectionAuthInfoSchema>;

/**
 * Row in the "per_request_weighted" section table
 */
export const PerRequestWeightedRowSchema = z.object({
  provider_id: z.string(),
  weighted_requests: z.number().min(0),
  cost: z.number().min(0),
  unit_price: z.number().min(0),
  currency: z.string().optional(),
  rate_limited: z.number().int().min(0),
  auths: z.array(SectionAuthInfoSchema).default([]),
});

export type PerRequestWeightedRow = z.infer<typeof PerRequestWeightedRowSchema>;

/**
 * "per_request_weighted" section
 */
export const PerRequestWeightedSectionSchema = z.object({
  label: z.string(),
  rows: z.array(PerRequestWeightedRowSchema),
  total_weighted_requests: z.number().min(0),
  total_cost: z.number().min(0),
  total_rate_limited: z.number().int().min(0),
});

export type PerRequestWeightedSection = z.infer<
  typeof PerRequestWeightedSectionSchema
>;

/**
 * Row in the "per_model_token" section table
 */
export const PerModelTokenRowSchema = z.object({
  provider_id: z.string(),
  tokens: z.number().min(0),
  cost: z.number().min(0),
  currency: z.string().optional(),
  avg_price_per_m: z.number().min(0),
  rate_limited: z.number().int().min(0),
  auths: z.array(SectionAuthInfoSchema).default([]),
});

export type PerModelTokenRow = z.infer<typeof PerModelTokenRowSchema>;

/**
 * "per_model_token" section
 */
export const PerModelTokenSectionSchema = z.object({
  label: z.string(),
  rows: z.array(PerModelTokenRowSchema),
  total_tokens: z.number().min(0),
  total_cost: z.number().min(0),
  total_rate_limited: z.number().int().min(0),
});

export type PerModelTokenSection = z.infer<typeof PerModelTokenSectionSchema>;

/**
 * Row in the "subscription" section
 */
export const SubscriptionRowSchema = z.object({
  provider_id: z.string(),
  used: z.number().min(0),
  quota: z.number().min(0).nullable(),
  cost: z.number().min(0),
  period: z.string(),
  overage_cost: z.number().min(0),
  currency: z.string().optional(),
  auths: z.array(SectionAuthInfoSchema).default([]),
});

export type SubscriptionRow = z.infer<typeof SubscriptionRowSchema>;

/**
 * "subscription" section
 */
export const SubscriptionSectionSchema = z.object({
  label: z.string(),
  rows: z.array(SubscriptionRowSchema),
  total_cost: z.number().min(0),
  total_rate_limited: z.number().int().min(0),
});

export type SubscriptionSection = z.infer<typeof SubscriptionSectionSchema>;

/**
 * Rate limited auth entry
 */
export const RateLimitedAuthEntrySchema = z.object({
  auth_key: z.string(),
  auth_name: z.string().optional(),
  provider_id: z.string(),
  triggered_rules: z.array(z.string()),
});

export type RateLimitedAuthEntry = z.infer<typeof RateLimitedAuthEntrySchema>;

/**
 * By-pricing-model sectioned dashboard data
 */
export const ByPricingModelSchema = z.object({
  per_request_weighted: PerRequestWeightedSectionSchema,
  per_model_token: PerModelTokenSectionSchema,
  subscription: SubscriptionSectionSchema,
});

export type ByPricingModel = z.infer<typeof ByPricingModelSchema>;

/**
 * Dashboard statistics — billing-model-sectioned layout
 * Top: overview cards (total_cost, total_requests, total_rate_limited)
 * Middle: three billing model sections
 * Bottom: rate-limited auths list
 */
export const DashboardStatsSchema = z.object({
  total_cost: z.number().min(0),
  total_requests: z.number().int().min(0),
  total_rate_limited: z.number().int().min(0),
  by_pricing_model: ByPricingModelSchema,
  rate_limited_auths: z.array(RateLimitedAuthEntrySchema),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

/**
 * Stats query parameters (simplified)
 */
export const StatsQuerySchema = z.object({
  auth_key: z.string().optional(),
  period: StatsRequestPeriodSchema.default("5h"),
  token_granularity: StatsTokenGranularitySchema.default("hour"),
});

export type StatsQuery = z.infer<typeof StatsQuerySchema>;
