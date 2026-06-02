import { z } from "zod";
import {
  ErrorResponseSchema,
  SuccessResponseSchema,
  PaginatedResponseSchema,
  PaginationQuerySchema,
  IdParamSchema,
  EmptySuccessSchema,
} from "./common.js";
import {
  CreateModelAliasSchema,
  UpdateModelAliasSchema,
  ModelAliasWithMetaSchema,
  ModelAliasListSchema,
} from "./models.js";
import {
  CreateProviderSchema,
  UpdateProviderSchema,
  ProviderWithMetaSchema,
  ProviderListSchema,
} from "./providers.js";
import {
  CreateAuthSchema,
  UpdateAuthSchema,
  AuthWithMetaSchema,
  AuthKeyValidationSchema,
} from "./auths.js";
import {
  DashboardStatsSchema,
  AuthStatsSchema,
  RequestsPerPeriodSchema,
  TokensPerHourSchema,
  StatsQuerySchema,
} from "./stats.js";

// ============================================================
// Model Alias API Endpoints
// ============================================================

/**
 * GET /api/models - List all model aliases
 * Query: pagination params
 * Response: paginated list of model aliases with metadata
 */
export const ListModelAliasesQuerySchema = PaginationQuerySchema.extend({
  enabled: z.coerce.boolean().optional(),
  provider_id: z.string().optional(),
});

export type ListModelAliasesQuery = z.infer<typeof ListModelAliasesQuerySchema>;

export const ListModelAliasesResponseSchema = PaginatedResponseSchema(
  ModelAliasWithMetaSchema,
);

export type ListModelAliasesResponse = z.infer<typeof ListModelAliasesResponseSchema>;

/**
 * GET /api/models/:id - Get a single model alias
 * Response: model alias with metadata
 */
export const GetModelAliasResponseSchema = SuccessResponseSchema(
  ModelAliasWithMetaSchema,
);

export type GetModelAliasResponse = z.infer<typeof GetModelAliasResponseSchema>;

/**
 * POST /api/models - Create a model alias
 * Body: create model alias input
 * Response: created model alias with metadata
 */
export const CreateModelAliasResponseSchema = SuccessResponseSchema(
  ModelAliasWithMetaSchema,
);

export type CreateModelAliasResponse = z.infer<typeof CreateModelAliasResponseSchema>;

/**
 * PATCH /api/models/:id - Update a model alias
 * Body: partial update input
 * Response: updated model alias with metadata
 */
export const UpdateModelAliasResponseSchema = SuccessResponseSchema(
  ModelAliasWithMetaSchema,
);

export type UpdateModelAliasResponse = z.infer<typeof UpdateModelAliasResponseSchema>;

/**
 * DELETE /api/models/:id - Delete a model alias
 * Response: empty success
 */
export const DeleteModelAliasResponseSchema = EmptySuccessSchema;

export type DeleteModelAliasResponse = z.infer<typeof DeleteModelAliasResponseSchema>;

// ============================================================
// Provider API Endpoints
// ============================================================

/**
 * GET /api/providers - List all providers
 * Query: pagination params
 * Response: paginated list of providers with metadata
 */
export const ListProvidersQuerySchema = PaginationQuerySchema.extend({
  enabled: z.coerce.boolean().optional(),
});

export type ListProvidersQuery = z.infer<typeof ListProvidersQuerySchema>;

export const ListProvidersResponseSchema = PaginatedResponseSchema(
  ProviderWithMetaSchema,
);

export type ListProvidersResponse = z.infer<typeof ListProvidersResponseSchema>;

/**
 * GET /api/providers/:id - Get a single provider
 * Response: provider with metadata
 */
export const GetProviderResponseSchema = SuccessResponseSchema(
  ProviderWithMetaSchema,
);

export type GetProviderResponse = z.infer<typeof GetProviderResponseSchema>;

/**
 * POST /api/providers - Create a provider
 * Body: create provider input
 * Response: created provider with metadata
 */
export const CreateProviderResponseSchema = SuccessResponseSchema(
  ProviderWithMetaSchema,
);

export type CreateProviderResponse = z.infer<typeof CreateProviderResponseSchema>;

/**
 * PATCH /api/providers/:id - Update a provider
 * Body: partial update input
 * Response: updated provider with metadata
 */
export const UpdateProviderResponseSchema = SuccessResponseSchema(
  ProviderWithMetaSchema,
);

export type UpdateProviderResponse = z.infer<typeof UpdateProviderResponseSchema>;

/**
 * DELETE /api/providers/:id - Delete a provider
 * Response: empty success
 */
export const DeleteProviderResponseSchema = EmptySuccessSchema;

export type DeleteProviderResponse = z.infer<typeof DeleteProviderResponseSchema>;

// ============================================================
// Auth API Endpoints (simplified — auths are nested under providers)
// ============================================================

/**
 * GET /api/providers/:id/auths - List auths for a provider
 * Response: array of auth keys with metadata
 */
export const ListAuthsQuerySchema = PaginationQuerySchema;

export type ListAuthsQuery = z.infer<typeof ListAuthsQuerySchema>;

export const ListAuthsResponseSchema = PaginatedResponseSchema(
  AuthWithMetaSchema,
);

export type ListAuthsResponse = z.infer<typeof ListAuthsResponseSchema>;

/**
 * GET /api/providers/:id/auths/:key - Get a single auth key
 * Response: auth key with metadata
 */
export const GetAuthResponseSchema = SuccessResponseSchema(
  AuthWithMetaSchema,
);

export type GetAuthResponse = z.infer<typeof GetAuthResponseSchema>;

/**
 * POST /api/providers/:id/auths - Create an auth key
 * Body: create auth input
 * Response: created auth key with metadata
 */
export const CreateAuthResponseSchema = SuccessResponseSchema(
  AuthWithMetaSchema,
);

export type CreateAuthResponse = z.infer<typeof CreateAuthResponseSchema>;

/**
 * PATCH /api/providers/:id/auths/:key - Update an auth key
 * Body: partial update input
 * Response: updated auth key with metadata
 */
export const UpdateAuthResponseSchema = SuccessResponseSchema(
  AuthWithMetaSchema,
);

export type UpdateAuthResponse = z.infer<typeof UpdateAuthResponseSchema>;

/**
 * DELETE /api/providers/:id/auths/:key - Delete an auth key
 * Response: empty success
 */
export const DeleteAuthResponseSchema = EmptySuccessSchema;

export type DeleteAuthResponse = z.infer<typeof DeleteAuthResponseSchema>;

/**
 * POST /api/auths/validate - Validate an auth key
 * Body: key to validate
 * Response: validation result
 */
export const ValidateAuthKeyResponseSchema = SuccessResponseSchema(
  AuthKeyValidationSchema,
);

export type ValidateAuthKeyResponse = z.infer<typeof ValidateAuthKeyResponseSchema>;

// ============================================================
// Stats API Endpoints (simplified)
// ============================================================

/**
 * GET /api/stats/dashboard - Get overall dashboard stats
 * Response: dashboard stats
 */
export const DashboardStatsQuerySchema = z.object({});

export type DashboardStatsQuery = z.infer<typeof DashboardStatsQuerySchema>;

export const DashboardStatsResponseSchema = SuccessResponseSchema(
  DashboardStatsSchema,
);

export type DashboardStatsResponse = z.infer<typeof DashboardStatsResponseSchema>;

/**
 * GET /api/stats/requests - Get request stats per auth key
 * Query: period (5h/week/month) + optional auth_key filter
 * Response: array of request stats per auth
 */
export const RequestStatsQuerySchema = StatsQuerySchema.pick({
  auth_key: true,
  period: true,
}).extend({
  period: z.enum(["5h", "week", "month"]).default("5h"),
});

export type RequestStatsQuery = z.infer<typeof RequestStatsQuerySchema>;

export const RequestStatsResponseSchema = SuccessResponseSchema(
  z.array(RequestsPerPeriodSchema),
);

export type RequestStatsResponse = z.infer<typeof RequestStatsResponseSchema>;

/**
 * GET /api/stats/tokens - Get token stats per auth key
 * Query: granularity (hour/day/month) + optional auth_key filter
 * Response: array of token stats per auth
 */
export const TokenStatsQuerySchema = StatsQuerySchema.pick({
  auth_key: true,
  token_granularity: true,
}).extend({
  token_granularity: z.enum(["hour", "day", "month"]).default("hour"),
});

export type TokenStatsQuery = z.infer<typeof TokenStatsQuerySchema>;

export const TokenStatsResponseSchema = SuccessResponseSchema(
  z.array(TokensPerHourSchema),
);

export type TokenStatsResponse = z.infer<typeof TokenStatsResponseSchema>;

/**
 * GET /api/stats/auths - Get per-auth key aggregated stats
 * Query: optional auth_key filter
 * Response: array of auth stats
 */
export const AuthStatsResponseSchema = SuccessResponseSchema(
  z.array(AuthStatsSchema),
);

export type AuthStatsResponse = z.infer<typeof AuthStatsResponseSchema>;

/**
 * Generic stats query params (used across all stats endpoints)
 */
export const ApiStatsQuerySchema = StatsQuerySchema;

export type ApiStatsQuery = z.infer<typeof ApiStatsQuerySchema>;

// ============================================================
// Gateway Proxy API Endpoints
// ============================================================

/**
 * POST /v1/chat/completions - OpenAI Chat Completions endpoint
 * Body: chat completion request
 * Response: chat completion response or stream
 */
export const ProxyChatCompletionRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant", "tool"]),
      content: z.union([z.string(), z.array(z.unknown())]).nullable(),
    }),
  ).min(1),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
  max_tokens: z.number().int().positive().optional(),
});

export type ProxyChatCompletionRequest = z.infer<typeof ProxyChatCompletionRequestSchema>;

/**
 * Health check response
 */
export const HealthCheckResponseSchema = z.object({
  status: z.literal("healthy"),
  uptime_seconds: z.number().nonnegative().optional(),
  version: z.string().optional(),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

/**
 * Config reload response
 */
export const ConfigReloadResponseSchema = SuccessResponseSchema(
  z.object({
    models_count: z.number().int().min(0),
    providers_count: z.number().int().min(0),
    auths_count: z.number().int().min(0),
    reloaded_at: z.string().datetime(),
  }),
);

export type ConfigReloadResponse = z.infer<typeof ConfigReloadResponseSchema>;

// ============================================================
// Generic API Error Schema (for documentation)
// ============================================================

/**
 * Standard API error that can be returned by any endpoint
 */
export const ApiErrorSchema = ErrorResponseSchema;

export type ApiError = z.infer<typeof ApiErrorSchema>;

// ============================================================
// Type helpers for route definitions
// ============================================================

/**
 * Route definition helper type for typed API routes
 */
export interface ApiRoute<TRequest = unknown, TResponse = unknown> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  requestSchema?: z.ZodType<TRequest>;
  responseSchema: z.ZodType<TResponse>;
  summary?: string;
}

// Model alias routes
export const ModelAliasRoutes: Record<string, ApiRoute> = {
  list: {
    method: "GET",
    path: "/api/models",
    requestSchema: ListModelAliasesQuerySchema,
    responseSchema: ListModelAliasesResponseSchema,
    summary: "List all model aliases",
  },
  get: {
    method: "GET",
    path: "/api/models/:id",
    requestSchema: IdParamSchema,
    responseSchema: GetModelAliasResponseSchema,
    summary: "Get a model alias by ID",
  },
  create: {
    method: "POST",
    path: "/api/models",
    requestSchema: CreateModelAliasSchema,
    responseSchema: CreateModelAliasResponseSchema,
    summary: "Create a new model alias",
  },
  update: {
    method: "PATCH",
    path: "/api/models/:id",
    requestSchema: UpdateModelAliasSchema,
    responseSchema: UpdateModelAliasResponseSchema,
    summary: "Update a model alias",
  },
  delete: {
    method: "DELETE",
    path: "/api/models/:id",
    requestSchema: IdParamSchema,
    responseSchema: DeleteModelAliasResponseSchema,
    summary: "Delete a model alias",
  },
};

// Provider routes
export const ProviderRoutes: Record<string, ApiRoute> = {
  list: {
    method: "GET",
    path: "/api/providers",
    requestSchema: ListProvidersQuerySchema,
    responseSchema: ListProvidersResponseSchema,
    summary: "List all providers",
  },
  get: {
    method: "GET",
    path: "/api/providers/:id",
    requestSchema: IdParamSchema,
    responseSchema: GetProviderResponseSchema,
    summary: "Get a provider by ID",
  },
  create: {
    method: "POST",
    path: "/api/providers",
    requestSchema: CreateProviderSchema,
    responseSchema: CreateProviderResponseSchema,
    summary: "Create a new provider",
  },
  update: {
    method: "PATCH",
    path: "/api/providers/:id",
    requestSchema: UpdateProviderSchema,
    responseSchema: UpdateProviderResponseSchema,
    summary: "Update a provider",
  },
  delete: {
    method: "DELETE",
    path: "/api/providers/:id",
    requestSchema: IdParamSchema,
    responseSchema: DeleteProviderResponseSchema,
    summary: "Delete a provider",
  },
};

// Auth routes (nested under providers)
export const AuthRoutes: Record<string, ApiRoute> = {
  list: {
    method: "GET",
    path: "/api/providers/:id/auths",
    requestSchema: ListAuthsQuerySchema,
    responseSchema: ListAuthsResponseSchema,
    summary: "List auth keys for a provider",
  },
  get: {
    method: "GET",
    path: "/api/providers/:id/auths/:key",
    requestSchema: IdParamSchema,
    responseSchema: GetAuthResponseSchema,
    summary: "Get an auth key for a provider",
  },
  create: {
    method: "POST",
    path: "/api/providers/:id/auths",
    requestSchema: CreateAuthSchema,
    responseSchema: CreateAuthResponseSchema,
    summary: "Create a new auth key for a provider",
  },
  update: {
    method: "PATCH",
    path: "/api/providers/:id/auths/:key",
    requestSchema: UpdateAuthSchema,
    responseSchema: UpdateAuthResponseSchema,
    summary: "Update an auth key for a provider",
  },
  delete: {
    method: "DELETE",
    path: "/api/providers/:id/auths/:key",
    requestSchema: IdParamSchema,
    responseSchema: DeleteAuthResponseSchema,
    summary: "Delete an auth key for a provider",
  },
  validate: {
    method: "POST",
    path: "/api/auths/validate",
    responseSchema: ValidateAuthKeyResponseSchema,
    summary: "Validate an auth key",
  },
};

// Stats routes (simplified)
export const StatsRoutes: Record<string, ApiRoute> = {
  dashboard: {
    method: "GET",
    path: "/api/stats/dashboard",
    requestSchema: DashboardStatsQuerySchema,
    responseSchema: DashboardStatsResponseSchema,
    summary: "Get dashboard stats",
  },
  requests: {
    method: "GET",
    path: "/api/stats/requests",
    requestSchema: RequestStatsQuerySchema,
    responseSchema: RequestStatsResponseSchema,
    summary: "Get request stats per auth key",
  },
  tokens: {
    method: "GET",
    path: "/api/stats/tokens",
    requestSchema: TokenStatsQuerySchema,
    responseSchema: TokenStatsResponseSchema,
    summary: "Get token stats per auth key",
  },
  auths: {
    method: "GET",
    path: "/api/stats/auths",
    requestSchema: ApiStatsQuerySchema,
    responseSchema: AuthStatsResponseSchema,
    summary: "Get per-auth aggregated stats",
  },
};

// Gateway proxy routes
export const GatewayRoutes: Record<string, ApiRoute> = {
  chatCompletions: {
    method: "POST",
    path: "/v1/chat/completions",
    requestSchema: ProxyChatCompletionRequestSchema,
    responseSchema: z.unknown(), // dynamic (streaming or non-streaming)
    summary: "OpenAI Chat Completions proxy",
  },
  health: {
    method: "GET",
    path: "/health",
    responseSchema: HealthCheckResponseSchema,
    summary: "Health check",
  },
  configReload: {
    method: "POST",
    path: "/api/config/reload",
    responseSchema: ConfigReloadResponseSchema,
    summary: "Reload configuration",
  },
};

// All routes combined
export const AllRoutes = {
  ...ModelAliasRoutes,
  ...ProviderRoutes,
  ...AuthRoutes,
  ...StatsRoutes,
  ...GatewayRoutes,
};
