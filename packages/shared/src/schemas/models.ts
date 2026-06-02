import { z } from "zod";

/**
 * Model alias entry: a provider_id + model_name pair
 */
export const ModelAliasEntrySchema = z.object({
  provider_id: z.string().min(1, "Provider is required"),
  model_name: z.string().min(1, "Model name is required"),
});

export type ModelAliasEntry = z.infer<typeof ModelAliasEntrySchema>;

/**
 * Routing strategy for model aliases with multiple models
 */
export const StrategySchema = z.enum([
  "proportional",
  "priority",
  "random",
  "round_robin",
  "least_loaded",
]);

export type Strategy = z.infer<typeof StrategySchema>;

/**
 * Model alias configuration
 * Maps a friendly alias to one or more provider/model pairs with a routing strategy.
 */
export const ModelAliasSchema = z.object({
  alias: z
    .string()
    .min(1, "Alias cannot be empty")
    .max(64, "Alias too long (max 64 chars)")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Alias can only contain letters, numbers, hyphens, underscores, and dots",
    ),
  strategy: StrategySchema.default("proportional"),
  models: z
    .array(ModelAliasEntrySchema)
    .min(1, "At least one model is required"),
  description: z.string().max(256).optional(),
  queue_timeout: z.number().int().min(0).default(30000),
  enabled: z.boolean().default(true),
  session_affinity: z.boolean().default(true),
  headers: z.record(z.string(), z.string()).optional(),
});

export type ModelAlias = z.infer<typeof ModelAliasSchema>;

/**
 * Model alias creation input
 */
export const CreateModelAliasSchema = ModelAliasSchema;

export type CreateModelAlias = z.infer<typeof CreateModelAliasSchema>;

/**
 * Model alias update input (all fields optional except models which needs the full list)
 */
export const UpdateModelAliasSchema = ModelAliasSchema.partial();

export type UpdateModelAlias = z.infer<typeof UpdateModelAliasSchema>;

/**
 * List model aliases response
 */
export const ModelAliasListSchema = z.array(ModelAliasSchema);

export type ModelAliasList = z.infer<typeof ModelAliasListSchema>;

/**
 * Model alias with additional metadata (from database)
 */
export const ModelAliasWithMetaSchema = ModelAliasSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ModelAliasWithMeta = z.infer<typeof ModelAliasWithMetaSchema>;
