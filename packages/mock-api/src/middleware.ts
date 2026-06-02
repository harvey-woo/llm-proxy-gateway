import type { MiddlewareHandler } from "hono";

/**
 * Middleware that adds a random delay of 100-500ms to simulate network latency.
 */
export const mockDelay: MiddlewareHandler = async (c, next) => {
  const delay = Math.floor(Math.random() * 401) + 100; // 100-500ms
  await new Promise((r) => setTimeout(r, delay));
  await next();
};
