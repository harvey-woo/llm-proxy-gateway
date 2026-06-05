import { z } from "zod";

// ── Auth type discriminator ──
// "api_key": traditional static API key (existing behavior)
// "oauth": OAuth 2.0 tokens (e.g. Codex) with auto-refresh
const AuthTypeSchema = z.enum(["api_key", "oauth"]).default("api_key");

// ── OAuth provider enum (extensible) ──
const OAuthProviderSchema = z.enum(["codex"]);

/**
 * Simplified Authorization configuration
 * Auths belong to a provider.
 *
 * - api_key mode: key is the static API key (existing behavior, fully backward compatible)
 * - oauth mode: key is the access_token; oauth_metadata stores full token set as JSON
 */
export const AuthSchema = z.object({
  /** API key (api_key mode) or access_token (oauth mode) */
  key: z
    .string()
    .min(1, "Key/token must not be empty")
    .max(512, "Key/token too long (max 512 chars)"),
  /** Human-readable label */
  name: z.string().max(128, "Key name too long (max 128 chars)").optional(),
  /** Auth type discriminator. Defaults to "api_key" for backward compatibility. */
  auth_type: AuthTypeSchema,
  /** OAuth provider identifier. Required when auth_type = "oauth". */
  oauth_provider: OAuthProviderSchema.optional(),
  /**
   * OAuth metadata as JSON string. Required when auth_type = "oauth".
   * Contains: access_token, refresh_token, id_token, account_id, email,
   * plan_type, expires_at, token_refreshed_at
   */
  oauth_metadata: z.string().optional(),
});

export type Auth = z.infer<typeof AuthSchema>;

/**
 * Auth creation input. Same as AuthSchema — oauth fields are optional
 * so api_key creation doesn't need to specify them.
 */
export const CreateAuthSchema = AuthSchema;

export type CreateAuth = z.infer<typeof CreateAuthSchema>;

/**
 * Auth update input. All fields optional.
 * To update OAuth tokens (e.g. after refresh), set key + oauth_metadata
 * with auth_type = "oauth".
 */
export const UpdateAuthSchema = z.object({
  key: z
    .string()
    .min(1, "Key/token must not be empty")
    .max(512, "Key/token too long (max 512 chars)")
    .optional(),
  name: z.string().max(128, "Key name too long (max 128 chars)").optional(),
  auth_type: AuthTypeSchema.optional(),
  oauth_provider: OAuthProviderSchema.optional(),
  oauth_metadata: z.string().optional(),
});

export type UpdateAuth = z.infer<typeof UpdateAuthSchema>;

/**
 * Auth with database metadata (rate limit status)
 */
export const AuthWithMetaSchema = AuthSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_used_at: z.string().datetime().nullable().optional(),
  total_requests: z.number().int().min(0).default(0),
  is_rate_limited: z.boolean().default(false),
  limited_by: z.string().optional(),
});

export type AuthWithMeta = z.infer<typeof AuthWithMetaSchema>;

/**
 * Parsed OAuth metadata (the JSON stored in oauth_metadata).
 * Not a Zod schema — this is a loose structure for internal use.
 */
export interface OAuthMetadata {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  account_id?: string;
  email?: string;
  plan_type?: string;
  expires_at?: string;
  token_refreshed_at?: string;
}

/**
 * Auth key validation response (simplified)
 */
export const AuthKeyValidationSchema = z.object({
  valid: z.boolean(),
  key_name: z.string().optional(),
  rate_limited: z.boolean().optional(),
});

export type AuthKeyValidation = z.infer<typeof AuthKeyValidationSchema>;
