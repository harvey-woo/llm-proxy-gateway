import { z } from "zod";

/**
 * Simplified Authorization configuration
 * Auths belong to a provider. Only key (required) and name (optional).
 */
export const AuthSchema = z.object({
  key: z
    .string()
    .min(8, "API key must be at least 8 characters")
    .max(256, "API key too long (max 256 chars)"),
  name: z
    .string()
    .max(128, "Key name too long (max 128 chars)")
    .optional(),
});

export type Auth = z.infer<typeof AuthSchema>;

/**
 * Auth creation input
 */
export const CreateAuthSchema = AuthSchema;

export type CreateAuth = z.infer<typeof CreateAuthSchema>;

/**
 * Auth update input (key is the identifier, name is updatable)
 */
export const UpdateAuthSchema = z.object({
  key: z
    .string()
    .min(8, "API key must be at least 8 characters")
    .max(256, "API key too long (max 256 chars)")
    .optional(),
  name: z
    .string()
    .max(128, "Key name too long (max 128 chars)")
    .optional(),
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
 * Auth key validation response (simplified)
 */
export const AuthKeyValidationSchema = z.object({
  valid: z.boolean(),
  key_name: z.string().optional(),
  rate_limited: z.boolean().optional(),
});

export type AuthKeyValidation = z.infer<typeof AuthKeyValidationSchema>;
