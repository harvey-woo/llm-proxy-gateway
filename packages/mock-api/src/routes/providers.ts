import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { CreateProvider, UpdateProvider } from "@llm-proxy/shared/schemas";
import { providersStore, modelsStore } from "../store.js";
import authsRouter from "./auths.js";

const router = new Hono();

// Mount auths sub-router under /api/providers/:id/auths
router.route("/:id/auths", authsRouter);

// GET /api/providers - List all providers with pagination
router.get("/", (c) => {
  const { page = 1, page_size = 20, enabled } = c.req.query();

  let items = Array.from(providersStore.values());

  if (enabled !== undefined) {
    const enabledBool = enabled === "true";
    items = items.filter((p) => p.enabled === enabledBool);
  }

  const total = items.length;
  const start = ((Number(page) || 1) - 1) * (Number(page_size) || 20);
  const paginated = items.slice(start, start + Number(page_size) || 20);

  return c.json({
    success: true,
    data: paginated,
    total,
    page: Number(page) || 1,
    page_size: Number(page_size) || 20,
  });
});

// GET /api/providers/:id - Get a single provider
router.get("/:id", (c) => {
  const id = c.req.param("id");
  const item = providersStore.get(id);
  if (!item) {
    return c.json(
      { success: false, error: "Provider not found", code: "NOT_FOUND" },
      404,
    );
  }
  return c.json({ success: true, data: item });
});

// Helper: resolve model aliases — auto-create/associate when alias is empty
function resolveModelAliases(
  models: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return models.map((m) => {
    const modelName = m.name as string;
    const alias = (m.alias as string) ?? "";

    if (!alias || alias.trim() === "") {
      // Empty alias: find existing alias with same name as model, or create one
      const existingAlias = Array.from(modelsStore.values()).find(
        (a) => a.alias === modelName,
      );
      if (existingAlias) {
        // Associate with existing alias
        return { ...m, alias: existingAlias.alias };
      }
      // Create a new alias with the model name as the alias name
      const now = new Date().toISOString();
      const newAlias = {
        id: randomUUID(),
        alias: modelName,
        strategy: "proportional" as const,
        models: [],
        queue_timeout: 30000,
        enabled: true,
        created_at: now,
        updated_at: now,
      };
      modelsStore.set(newAlias.id, newAlias);
      return { ...m, alias: modelName };
    }

    return m;
  });
}

// POST /api/providers - Create a provider
router.post("/", async (c) => {
  const body = (await c.req.json()) as CreateProvider & {
    auths?: Array<{ key: string; name?: string }>;
  };

  if (providersStore.has(body.id)) {
    return c.json(
      {
        success: false,
        error: "Provider already exists",
        code: "DUPLICATE_ID",
      },
      409,
    );
  }

  // Resolve empty aliases: auto-create or associate
  if (body.models) {
    body.models = resolveModelAliases(
      body.models as Array<Record<string, unknown>>,
    ) as typeof body.models;
  }

  const now = new Date().toISOString();
  const auths = (body.auths ?? []).map((a) => ({
    id: randomUUID(),
    key: a.key,
    name: a.name,
    created_at: now,
    updated_at: now,
    last_used_at: null,
    total_requests: 0,
    is_rate_limited: false,
  }));

  const newItem = {
    ...body,
    auths,
    rate_limits: body.rate_limits ?? [],
    request_timeout_ms: body.request_timeout_ms ?? 60000,
    max_retries: body.max_retries ?? 3,
    enabled: body.enabled ?? true,
    health_status: "unknown" as const,
    created_at: now,
    updated_at: now,
  };

  providersStore.set(newItem.id, newItem);
  return c.json({ success: true, data: newItem }, 201);
});

// PATCH /api/providers/:id - Update a provider
router.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = providersStore.get(id);
  if (!existing) {
    return c.json(
      { success: false, error: "Provider not found", code: "NOT_FOUND" },
      404,
    );
  }

  const body = (await c.req.json()) as UpdateProvider & {
    auths?: Array<{ key: string; name?: string }>;
  };

  // Resolve empty aliases: auto-create or associate
  if (body.models) {
    body.models = resolveModelAliases(
      body.models as Array<Record<string, unknown>>,
    ) as typeof body.models;
  }

  // Check duplicate id if changing
  if (body.id && body.id !== existing.id) {
    if (providersStore.has(body.id)) {
      return c.json(
        {
          success: false,
          error: "Provider already exists",
          code: "DUPLICATE_ID",
        },
        409,
      );
    }
  }

  // Handle auths update if provided
  let auths = existing.auths;
  if (body.auths) {
    const now = new Date().toISOString();
    auths = body.auths.map((a) => {
      const existingAuth = existing.auths.find((ea) => ea.key === a.key);
      return {
        id: existingAuth?.id ?? randomUUID(),
        key: a.key,
        name: a.name,
        created_at: existingAuth?.created_at ?? now,
        updated_at: now,
        last_used_at: existingAuth?.last_used_at ?? null,
        total_requests: existingAuth?.total_requests ?? 0,
        is_rate_limited: existingAuth?.is_rate_limited ?? false,
      };
    });
  }

  const updated = {
    ...existing,
    ...body,
    auths,
    id: body.id ?? id,
    updated_at: new Date().toISOString(),
  };
  // Re-key if ID changed
  if (body.id && body.id !== id) {
    providersStore.delete(id);
  }
  providersStore.set(updated.id, updated);
  return c.json({ success: true, data: updated });
});

// DELETE /api/providers/:id - Delete a provider
router.delete("/:id", (c) => {
  const id = c.req.param("id");
  if (!providersStore.has(id)) {
    return c.json(
      { success: false, error: "Provider not found", code: "NOT_FOUND" },
      404,
    );
  }
  providersStore.delete(id);
  return c.json({ success: true });
});

export default router;
