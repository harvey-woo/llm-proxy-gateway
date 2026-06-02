import { z } from "zod";

/**
 * Standard API error response schema
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.array(z.string()).optional(),
  code: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Standard API success response wrapper
 */
export function SuccessResponseSchema<T extends z.ZodType>(data: T) {
  return z.object({
    success: z.literal(true),
    data,
  });
}

/**
 * Paginated list response schema
 */
export function PaginatedResponseSchema<T extends z.ZodType>(item: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
  });
}

/**
 * API response that can be either success or error
 */
export function ApiResponseSchema<T extends z.ZodType>(data: T) {
  return z.union([
    SuccessResponseSchema(data),
    ErrorResponseSchema,
  ]);
}

/**
 * Generic ID parameter schema
 */
export const IdParamSchema = z.object({
  id: z.string().min(1, "ID cannot be empty"),
});

export type IdParam = z.infer<typeof IdParamSchema>;

/**
 * Pagination query parameters
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Empty success response for delete/update operations
 */
export const EmptySuccessSchema = z.object({
  success: z.literal(true),
});

export type EmptySuccess = z.infer<typeof EmptySuccessSchema>;
