import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type {
  CreateModelAlias,
  UpdateModelAlias,
} from "@llm-proxy/shared/schemas";
import { modelsStore } from "../store.js";

const router = new Hono();

// GET /api/models - List all model aliases with pagination
router.get("/", (c) => {
  const { page = 1, page_size = 20, enabled } = c.req.query();

  let items = Array.from(modelsStore.values());

  if (enabled !== undefined) {
    const enabledBool = enabled === "true";
    items = items.filter((m) => m.enabled === enabledBool);
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

// GET /api/models/:id - Get a single model alias
router.get("/:id", (c) => {
  const id = c.req.param("id");
  const item = modelsStore.get(id);
  if (!item) {
    return c.json(
      { success: false, error: "Model alias not found", code: "NOT_FOUND" },
      404,
    );
  }
  return c.json({ success: true, data: item });
});

// POST /api/models - Create a model alias
router.post("/", async (c) => {
  const body = (await c.req.json()) as CreateModelAlias;

  // Check duplicate alias
  const existing = Array.from(modelsStore.values()).find(
    (m) => m.alias === body.alias,
  );
  if (existing) {
    return c.json(
      {
        success: false,
        error: "Model alias already exists",
        code: "DUPLICATE_ALIAS",
      },
      409,
    );
  }

  const now = new Date().toISOString();
  const newItem = {
    ...body,
    id: randomUUID(),
    strategy: body.strategy ?? "proportional",
    models: body.models ?? [],
    queue_timeout: body.queue_timeout ?? 30000,
    enabled: body.enabled ?? true,
    created_at: now,
    updated_at: now,
  };

  modelsStore.set(newItem.id, newItem);
  return c.json({ success: true, data: newItem }, 201);
});

// PATCH /api/models/:id - Update a model alias
router.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = modelsStore.get(id);
  if (!existing) {
    return c.json(
      { success: false, error: "Model alias not found", code: "NOT_FOUND" },
      404,
    );
  }

  const body = (await c.req.json()) as UpdateModelAlias;

  // Check duplicate alias if changing
  if (body.alias && body.alias !== existing.alias) {
    const duplicate = Array.from(modelsStore.values()).find(
      (m) => m.alias === body.alias,
    );
    if (duplicate) {
      return c.json(
        {
          success: false,
          error: "Model alias already exists",
          code: "DUPLICATE_ALIAS",
        },
        409,
      );
    }
  }

  const updated = {
    ...existing,
    ...body,
    id,
    updated_at: new Date().toISOString(),
  };
  modelsStore.set(id, updated);
  return c.json({ success: true, data: updated });
});

// DELETE /api/models/:id - Delete a model alias
router.delete("/:id", (c) => {
  const id = c.req.param("id");
  if (!modelsStore.has(id)) {
    return c.json(
      { success: false, error: "Model alias not found", code: "NOT_FOUND" },
      404,
    );
  }
  modelsStore.delete(id);
  return c.json({ success: true });
});

export default router;
