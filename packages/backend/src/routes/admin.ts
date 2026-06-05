import { Hono } from "hono";
import type { LoadedConfig } from "../config/loader.js";
import { saveProvidersToConfig } from "../config/loader.js";
import type { ModelAlias, Provider } from "@llm-proxy/shared/schemas";
import { getDb } from "../db/database.js";
import { randomUUID } from "node:crypto";

export interface StoreState {
  models: Map<string, ModelAlias>;
  providers: Map<string, Provider>;
}

/**
 * Create mutable in-memory stores seeded from config.
 * Write operations modify these stores; config reload resets them.
 */
export function createStoreState(config: LoadedConfig): StoreState {
  return {
    models: new Map(config.models),
    providers: new Map(config.providers),
  };
}

export function createAdminRoutes(
  configRef: { current: LoadedConfig },
  storeRef: { current: StoreState },
  onReload?: () => Promise<LoadedConfig>,
  onAuthChange?: () => void,
): Hono {
  const router = new Hono();

  // ============================================================
  // Model Alias Routes
  // ============================================================

  // GET /api/models - List all model aliases
  router.get("/api/models", (c) => {
    const { page = "1", page_size = "20", enabled } = c.req.query();

    let items = Array.from(storeRef.current.models.values()).map((m) => ({
      ...m,
      id: m.alias,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    if (enabled !== undefined) {
      const enabledBool = enabled === "true";
      items = items.filter((m) => m.enabled === enabledBool);
    }

    const total = items.length;
    const start = ((Number(page) || 1) - 1) * (Number(page_size) || 20);
    const paginated = items.slice(start, start + (Number(page_size) || 20));

    return c.json({
      success: true,
      data: paginated,
      total,
      page: Number(page) || 1,
      page_size: Number(page_size) || 20,
    });
  });

  // GET /api/models/:id
  router.get("/api/models/:id", (c) => {
    const id = c.req.param("id");
    const model = storeRef.current.models.get(id);

    if (!model) {
      return c.json(
        { success: false, error: "Model alias not found", code: "NOT_FOUND" },
        404,
      );
    }

    return c.json({
      success: true,
      data: {
        ...model,
        id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  });

  // POST /api/models - Create a model alias
  router.post("/api/models", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;

    const alias = body.alias as string;
    if (!alias) {
      return c.json({ success: false, error: "Alias is required" }, 400);
    }

    // Check duplicate
    if (storeRef.current.models.has(alias)) {
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
    const newItem: ModelAlias = {
      alias,
      strategy: (body.strategy as string) ?? "proportional",
      models:
        (body.models as Array<{ provider_id: string; model_name: string }>) ??
        [],
      queue_timeout: (body.queue_timeout as number) ?? 30000,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      description: body.description as string | undefined,
    };

    storeRef.current.models.set(alias, newItem);
    saveProvidersToConfig(storeRef.current.providers, storeRef.current.models);

    return c.json(
      {
        success: true,
        data: {
          ...newItem,
          id: alias,
          created_at: now,
          updated_at: now,
        },
      },
      201,
    );
  });

  // PATCH /api/models/:id - Update a model alias
  router.patch("/api/models/:id", async (c) => {
    const id = c.req.param("id");
    const existing = storeRef.current.models.get(id);

    if (!existing) {
      return c.json(
        { success: false, error: "Model alias not found", code: "NOT_FOUND" },
        404,
      );
    }

    const body = (await c.req.json()) as Record<string, unknown>;

    // Check duplicate alias if changing alias name
    const newAlias = body.alias as string | undefined;
    if (newAlias && newAlias !== id && storeRef.current.models.has(newAlias)) {
      return c.json(
        {
          success: false,
          error: "Model alias already exists",
          code: "DUPLICATE_ALIAS",
        },
        409,
      );
    }

    const updated: ModelAlias = {
      ...existing,
      alias: newAlias ?? id,
      strategy: (body.strategy as string) ?? existing.strategy,
      models:
        (body.models as Array<{ provider_id: string; model_name: string }>) ??
        existing.models,
      queue_timeout: (body.queue_timeout as number) ?? existing.queue_timeout,
      enabled:
        body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled,
      description:
        body.description !== undefined
          ? (body.description as string | undefined)
          : existing.description,
    };

    // If alias changed, re-key
    if (newAlias && newAlias !== id) {
      storeRef.current.models.delete(id);
    }
    storeRef.current.models.set(updated.alias, updated);
    saveProvidersToConfig(storeRef.current.providers, storeRef.current.models);

    return c.json({
      success: true,
      data: {
        ...updated,
        id: updated.alias,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  });

  // DELETE /api/models/:id
  router.delete("/api/models/:id", (c) => {
    const id = c.req.param("id");
    if (!storeRef.current.models.has(id)) {
      return c.json(
        { success: false, error: "Model alias not found", code: "NOT_FOUND" },
        404,
      );
    }
    storeRef.current.models.delete(id);
    saveProvidersToConfig(storeRef.current.providers, storeRef.current.models);
    return c.json({ success: true });
  });

  // ============================================================
  // Provider Routes
  // ============================================================

  // GET /api/providers
  router.get("/api/providers", (c) => {
    const { page = "1", page_size = "20", enabled } = c.req.query();

    let items = Array.from(storeRef.current.providers.values()).map((p) => ({
      ...p,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      health_status: "unknown" as const,
    }));

    if (enabled !== undefined) {
      const enabledBool = enabled === "true";
      items = items.filter((p) => p.enabled === enabledBool);
    }

    const total = items.length;
    const start = ((Number(page) || 1) - 1) * (Number(page_size) || 20);
    const paginated = items.slice(start, start + (Number(page_size) || 20));

    return c.json({
      success: true,
      data: paginated,
      total,
      page: Number(page) || 1,
      page_size: Number(page_size) || 20,
    });
  });

  // GET /api/providers/:id
  router.get("/api/providers/:id", (c) => {
    const id = c.req.param("id");
    const provider = storeRef.current.providers.get(id);

    if (!provider) {
      return c.json(
        { success: false, error: "Provider not found", code: "NOT_FOUND" },
        404,
      );
    }

    return c.json({
      success: true,
      data: {
        ...provider,
        id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        health_status: "unknown" as const,
      },
    });
  });

  // POST /api/providers - Create a provider
  router.post("/api/providers", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;

    const id = body.id as string;
    if (!id) {
      return c.json({ success: false, error: "Provider ID is required" }, 400);
    }

    if (storeRef.current.providers.has(id)) {
      return c.json(
        {
          success: false,
          error: "Provider already exists",
          code: "DUPLICATE_ID",
        },
        409,
      );
    }

    // Resolve model aliases if needed
    const models = (body.models as Array<Record<string, unknown>>) ?? [];
    const resolvedModels = resolveModelAliases(
      models,
      storeRef.current.models,
      id,
    );

    const now = new Date().toISOString();
    const auths = (
      (body.auths as Array<{ key: string; name?: string }>) ?? []
    ).map((a) => ({
      key: a.key,
      name: a.name,
    }));

    const newItem: Provider = {
      id,
      name: (body.name as string) ?? id,
      base_url: body.base_url as string,
      models: resolvedModels,
      auths,
      rate_limits:
        (body.rate_limits as Array<{
          type: string;
          max: number;
          period?: string;
        }>) ?? [],
      request_timeout_ms: (body.request_timeout_ms as number) ?? 60000,
      max_retries: (body.max_retries as number) ?? 3,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      pricing_model: (body.pricing_model as string) ?? "per_request_weighted",
      unit_price: (body.unit_price as number) ?? 0.001,
      currency: (body.currency as string) ?? "USD",
      subscription: body.subscription as Record<string, unknown> | undefined,
      api_format: (body.api_format as string) ?? "openai_chat",
      headers: (body.headers as Record<string, string>) ?? {},
      description: body.description as string | undefined,
    };

    storeRef.current.providers.set(id, newItem);

    // Save auths to DB so they survive config reload
    if (auths.length > 0) {
      try {
        const db = await getDb();
        for (const a of auths) {
          await db
            .insertInto("provider_auths")
            .values({
              id: randomUUID(),
              provider_id: id,
              key: a.key,
              name: a.name ?? null,
              created_at: now,
              updated_at: now,
            })
            .onConflict((oc) => oc.doNothing())
            .execute();
        }
      } catch (err) {
        console.warn(
          `[admin] Failed to save auths to DB for provider "${id}":`,
          err,
        );
      }
    }

    saveProvidersToConfig(storeRef.current.providers, storeRef.current.models);

    return c.json(
      {
        success: true,
        data: {
          ...newItem,
          created_at: now,
          updated_at: now,
          health_status: "unknown" as const,
        },
      },
      201,
    );
  });

  // PATCH /api/providers/:id - Update a provider
  router.patch("/api/providers/:id", async (c) => {
    const id = c.req.param("id");
    const existing = storeRef.current.providers.get(id);

    if (!existing) {
      return c.json(
        { success: false, error: "Provider not found", code: "NOT_FOUND" },
        404,
      );
    }

    const body = (await c.req.json()) as Record<string, unknown>;

    // Check duplicate id if changing
    const newId = body.id as string | undefined;
    if (newId && newId !== id && storeRef.current.providers.has(newId)) {
      return c.json(
        {
          success: false,
          error: "Provider already exists",
          code: "DUPLICATE_ID",
        },
        409,
      );
    }

    // Resolve model aliases
    let models = existing.models;
    if (body.models) {
      models = resolveModelAliases(
        (body.models as Array<Record<string, unknown>>) ?? [],
        storeRef.current.models,
        newId ?? id,
      );
    }

    const updatedId = newId ?? id;
    const updated: Provider = {
      ...existing,
      id: updatedId,
      name: (body.name as string) ?? existing.name,
      // base_url is immutable after creation — always use existing value
      base_url: existing.base_url,
      models,
      auths:
        body.auths !== undefined
          ? ((body.auths as Array<{ key: string; name?: string }>) ?? []).map(
              (a) => ({ key: a.key, name: a.name }),
            )
          : existing.auths,
      rate_limits:
        (body.rate_limits as Array<{
          type: string;
          max: number;
          period?: string;
        }>) ?? existing.rate_limits,
      request_timeout_ms:
        (body.request_timeout_ms as number) ?? existing.request_timeout_ms,
      max_retries: (body.max_retries as number) ?? existing.max_retries,
      enabled:
        body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled,
      pricing_model: (body.pricing_model as string) ?? existing.pricing_model,
      unit_price: (body.unit_price as number) ?? existing.unit_price,
      subscription:
        body.subscription !== undefined
          ? (body.subscription as {
              price: number;
              period: string;
              billing_type: string;
              included_requests?: number;
              overage_unit_price?: number;
              included_tokens?: number;
            })
          : existing.subscription,
      currency: (body.currency as string) ?? existing.currency,
    };

    if (newId && newId !== id) {
      storeRef.current.providers.delete(id);
    }
    storeRef.current.providers.set(updatedId, updated);
    saveProvidersToConfig(storeRef.current.providers, storeRef.current.models);

    return c.json({
      success: true,
      data: {
        ...updated,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        health_status: "unknown" as const,
      },
    });
  });

  // DELETE /api/providers/:id
  router.delete("/api/providers/:id", async (c) => {
    const id = c.req.param("id");
    const provider = storeRef.current.providers.get(id);

    if (!provider) {
      return c.json(
        { success: false, error: "Provider not found", code: "NOT_FOUND" },
        404,
      );
    }

    const authCount = provider.auths?.length ?? 0;
    const query = c.req.query();
    const force = query.force === "true";

    if (authCount > 0 && !force) {
      return c.json(
        {
          success: false,
          error: `Provider has ${authCount} auth key(s). Set force=true to delete all.`,
          code: "HAS_AUTHS",
          auth_count: authCount,
        },
        409,
      );
    }

    // Delete associated auths from DB
    if (authCount > 0) {
      try {
        const db = await getDb();
        await db
          .deleteFrom("provider_auths")
          .where("provider_id", "=", id)
          .execute();
      } catch {
        // DB might not be available — proceed with in-memory delete
      }
    }

    storeRef.current.providers.delete(id);
    saveProvidersToConfig(storeRef.current.providers, storeRef.current.models);
    return c.json({ success: true, auths_deleted: authCount });
  });

  // ============================================================
  // Auth Routes (nested under providers)
  // ============================================================

  // GET /api/providers/:id/auths
  router.get("/api/providers/:id/auths", async (c) => {
    const providerId = c.req.param("id");
    const provider = storeRef.current.providers.get(providerId);

    if (!provider) {
      return c.json(
        { success: false, error: "Provider not found", code: "NOT_FOUND" },
        404,
      );
    }

    const db = await getDb();
    const rows = await db
      .selectFrom("provider_auths")
      .selectAll()
      .where("provider_id", "=", providerId)
      .execute();

    const items = rows.map((row) => ({
      key: row.key,
      name: row.name ?? undefined,
      auth_type: (row.auth_type as "api_key" | "oauth") ?? "api_key",
      oauth_metadata:
        row.auth_type === "oauth" ? (row.metadata ?? undefined) : undefined,
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return c.json({
      success: true,
      data: items,
      total: items.length,
      page: 1,
      page_size: items.length,
    });
  });

  // GET /api/providers/:id/auths/:key
  router.get("/api/providers/:id/auths/:key", async (c) => {
    const providerId = c.req.param("id");
    const key = c.req.param("key");
    const provider = storeRef.current.providers.get(providerId);

    if (!provider) {
      return c.json(
        { success: false, error: "Provider not found", code: "NOT_FOUND" },
        404,
      );
    }

    const db = await getDb();
    const row = await db
      .selectFrom("provider_auths")
      .selectAll()
      .where("provider_id", "=", providerId)
      .where("key", "=", key)
      .executeTakeFirst();

    if (!row) {
      return c.json(
        { success: false, error: "Auth key not found", code: "NOT_FOUND" },
        404,
      );
    }

    return c.json({
      success: true,
      data: {
        key: row.key,
        name: row.name ?? undefined,
        auth_type: (row.auth_type as "api_key" | "oauth") ?? "api_key",
        oauth_metadata:
          row.auth_type === "oauth" ? (row.metadata ?? undefined) : undefined,
        id: row.id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  });

  // POST /api/providers/:id/auths - Create an auth key
  router.post("/api/providers/:id/auths", async (c) => {
    const providerId = c.req.param("id");
    const provider = storeRef.current.providers.get(providerId);

    if (!provider) {
      return c.json(
        { success: false, error: "Provider not found", code: "NOT_FOUND" },
        404,
      );
    }

    const body = (await c.req.json()) as {
      key: string;
      name?: string;
      auth_type?: "api_key" | "oauth";
      oauth_provider?: string;
      oauth_metadata?: string;
    };
    if (!body.key) {
      return c.json({ success: false, error: "Key is required" }, 400);
    }

    const db = await getDb();

    // Check duplicate key
    const existing = await db
      .selectFrom("provider_auths")
      .selectAll()
      .where("provider_id", "=", providerId)
      .where("key", "=", body.key)
      .executeTakeFirst();

    if (existing) {
      // Key already exists — no-op, return existing
      return c.json({
        success: true,
        data: {
          key: existing.key,
          name: existing.name,
          id: existing.id,
          created_at: existing.created_at,
          updated_at: existing.updated_at,
        },
      });
    }

    const authType = body.auth_type ?? "api_key";
    const metadata =
      authType === "oauth" ? (body.oauth_metadata ?? null) : null;

    const now = new Date().toISOString();
    const id = randomUUID();

    await db
      .insertInto("provider_auths")
      .values({
        id,
        provider_id: providerId,
        key: body.key,
        name: body.name ?? null,
        auth_type: authType,
        metadata,
        created_at: now,
        updated_at: now,
      })
      .execute();

    // Keep in-memory state in sync
    const newAuth: Record<string, unknown> = {
      key: body.key,
      name: body.name,
      auth_type: authType,
    };
    if (authType === "oauth") {
      newAuth.oauth_provider = body.oauth_provider;
      newAuth.oauth_metadata = body.oauth_metadata;
    }
    provider.auths = [...(provider.auths ?? []), newAuth] as any;
    storeRef.current.providers.set(providerId, provider);
    saveProvidersToConfig(storeRef.current.providers);

    return c.json(
      {
        success: true,
        data: {
          key: body.key,
          name: body.name,
          auth_type: authType,
          oauth_metadata:
            authType === "oauth" ? body.oauth_metadata : undefined,
          id,
          created_at: now,
          updated_at: now,
        },
      },
      201,
    );
  });

  // PATCH /api/providers/:id/auths/:key - Update an auth key
  router.patch("/api/providers/:id/auths/:key", async (c) => {
    const providerId = c.req.param("id");
    const key = c.req.param("key");
    const provider = storeRef.current.providers.get(providerId);

    if (!provider) {
      return c.json(
        { success: false, error: "Provider not found", code: "NOT_FOUND" },
        404,
      );
    }

    const db = await getDb();

    const row = await db
      .selectFrom("provider_auths")
      .selectAll()
      .where("provider_id", "=", providerId)
      .where("key", "=", key)
      .executeTakeFirst();

    if (!row) {
      return c.json(
        { success: false, error: "Auth key not found", code: "NOT_FOUND" },
        404,
      );
    }

    const body = (await c.req.json()) as {
      key?: string;
      name?: string;
      auth_type?: "api_key" | "oauth";
      oauth_provider?: string;
      oauth_metadata?: string;
    };

    const updatedKey = body.key ?? row.key;
    const updatedName =
      body.name !== undefined ? body.name : (row.name ?? undefined);
    const authType = body.auth_type ?? (row.auth_type as string) ?? "api_key";
    const metadata =
      authType === "oauth"
        ? (body.oauth_metadata ?? row.metadata ?? null)
        : null;
    const now = new Date().toISOString();

    await db
      .updateTable("provider_auths")
      .set({
        key: updatedKey,
        name: updatedName ?? null,
        auth_type: authType,
        metadata,
        updated_at: now,
      })
      .where("id", "=", row.id)
      .execute();

    // Keep in-memory state in sync
    const authIndex = (provider.auths ?? []).findIndex((a) => a.key === key);
    const updatedAuth: Record<string, unknown> = {
      key: updatedKey,
      name: updatedName,
      auth_type: authType,
    };
    if (authType === "oauth") {
      updatedAuth.oauth_provider = body.oauth_provider ?? "codex";
      updatedAuth.oauth_metadata = metadata;
    }
    if (authIndex !== -1) {
      provider.auths![authIndex] = updatedAuth as any;
    } else {
      provider.auths = [...(provider.auths ?? []), updatedAuth as any];
    }
    storeRef.current.providers.set(providerId, provider);
    onAuthChange?.();
    saveProvidersToConfig(storeRef.current.providers);

    return c.json({
      success: true,
      data: {
        key: updatedKey,
        name: updatedName,
        auth_type: authType,
        oauth_metadata: authType === "oauth" ? metadata : undefined,
        id: row.id,
        created_at: row.created_at,
        updated_at: now,
      },
    });
  });

  // DELETE /api/providers/:id/auths/:key
  router.delete("/api/providers/:id/auths/:key", async (c) => {
    const providerId = c.req.param("id");
    const key = c.req.param("key");
    const provider = storeRef.current.providers.get(providerId);

    if (!provider) {
      return c.json(
        { success: false, error: "Provider not found", code: "NOT_FOUND" },
        404,
      );
    }

    const db = await getDb();

    const row = await db
      .selectFrom("provider_auths")
      .selectAll()
      .where("provider_id", "=", providerId)
      .where("key", "=", key)
      .executeTakeFirst();

    if (!row) {
      return c.json(
        { success: false, error: "Auth key not found", code: "NOT_FOUND" },
        404,
      );
    }

    await db.deleteFrom("provider_auths").where("id", "=", row.id).execute();

    // Keep in-memory state in sync
    const authIndex = (provider.auths ?? []).findIndex((a) => a.key === key);
    if (authIndex !== -1) {
      provider.auths!.splice(authIndex, 1);
    }
    storeRef.current.providers.set(providerId, provider);
    onAuthChange?.();
    saveProvidersToConfig(storeRef.current.providers);

    return c.json({ success: true });
  });

  // POST /api/auths/validate - Validate an auth key across all providers
  router.post("/api/auths/validate", async (c) => {
    const body = await c.req.json();
    const key = (body as Record<string, unknown>).key as string;

    if (!key) {
      return c.json({ success: false, error: "Key is required" }, 400);
    }

    for (const [, provider] of storeRef.current.providers.entries()) {
      const auth = (provider.auths ?? []).find((a) => a.key === key);
      if (auth) {
        return c.json({
          success: true,
          data: {
            valid: true,
            key_name: auth.name,
            rate_limited: false,
          },
        });
      }
    }

    return c.json({
      success: true,
      data: {
        valid: false,
      },
    });
  });

  // ============================================================
  // OAuth Import Endpoint — 导入 OAuth tokens 作为凭证
  // ============================================================

  // POST /api/oauth/import - Import OAuth tokens for a provider
  // 接受两种输入格式：
  //   1. 结构化字段: { provider_id, access_token, refresh_token?, email?, plan_type?, expires_at? }
  //   2. 原始 Session JSON: { provider_id, session_json } — 从 https://chatgpt.com/api/auth/session 粘贴
  router.post("/api/oauth/import", async (c) => {
    const raw = (await c.req.json()) as Record<string, unknown>;

    const providerId = raw.provider_id as string;
    if (!providerId) {
      return c.json({ success: false, error: "provider_id is required" }, 400);
    }

    let accessToken: string;
    let refreshToken: string | undefined;
    let email: string | undefined;
    let planType: string | undefined;
    let expiresAt: string | undefined;

    // Case 1: raw session JSON pasted directly
    if (raw.session_json && typeof raw.session_json === "string") {
      try {
        const session = JSON.parse(raw.session_json) as Record<string, unknown>;
        accessToken = (session.accessToken ??
          session.access_token ??
          "") as string;
        refreshToken = (session.sessionToken ?? session.refresh_token) as
          | string
          | undefined;
        email = ((session.user as Record<string, unknown>)?.email ??
          (session as Record<string, unknown>).email) as string | undefined;
        expiresAt = (session.expires as string) ?? undefined;
        const account = session.account as Record<string, unknown> | undefined;
        planType = (account?.planType ?? account?.plan_type) as
          | string
          | undefined;

        // Parse JWT for plan type if not in top-level
        if (!planType && accessToken?.includes(".")) {
          try {
            const parts = accessToken.split(".");
            const jwt = JSON.parse(atob(parts[1]));
            const codexAuth = (jwt as Record<string, unknown>)[
              "https://api.openai.com/auth"
            ] as Record<string, unknown> | undefined;
            if (codexAuth?.chatgpt_plan_type) {
              planType = codexAuth.chatgpt_plan_type as string;
            }
          } catch {
            /* ignore JWT parse errors */
          }
        }
      } catch {
        return c.json(
          { success: false, error: "Invalid session_json: not valid JSON" },
          400,
        );
      }
    } else {
      // Case 2: individual fields
      accessToken = raw.access_token as string;
      refreshToken = raw.refresh_token as string | undefined;
      email = raw.email as string | undefined;
      planType = raw.plan_type as string | undefined;
      expiresAt = raw.expires_at as string | undefined;
    }

    if (!accessToken) {
      return c.json(
        {
          success: false,
          error: "access_token or session_json with accessToken is required",
        },
        400,
      );
    }

    let provider = storeRef.current.providers.get(providerId);
    if (!provider) {
      // Auto-create a minimal provider entry if it doesn't exist
      provider = {
        id: providerId,
        name: providerId,
        base_url: "https://api.openai.com",
        models: [],
        auths: [],
        rate_limits: [],
        request_timeout_ms: 60000,
        max_retries: 3,
        enabled: true,
        pricing_model: "per_request_weighted",
        unit_price: 0.001,
        currency: "USD",
        api_format: "openai_chat",
      } as Provider;
      storeRef.current.providers.set(providerId, provider);
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const id = randomUUID();

    const metadata: Record<string, string> = {
      access_token: accessToken,
    };
    if (refreshToken) metadata.refresh_token = refreshToken;
    if (email) metadata.email = email;
    if (planType) metadata.plan_type = planType;
    if (expiresAt) metadata.expires_at = expiresAt;
    metadata.token_refreshed_at = now;

    const metadataJson = JSON.stringify(metadata);
    const displayName =
      (raw.name as string | undefined) ??
      (email ? `Codex (${email})` : "Codex OAuth");

    await db
      .insertInto("provider_auths")
      .values({
        id,
        provider_id: providerId,
        key: accessToken,
        name: displayName,
        auth_type: "oauth",
        metadata: metadataJson,
        created_at: now,
        updated_at: now,
      })
      .execute();

    // Keep in-memory state in sync
    const newAuth: Record<string, unknown> = {
      key: accessToken,
      name: displayName,
      auth_type: "oauth",
      oauth_provider: "codex",
      oauth_metadata: metadataJson,
    };
    provider.auths = [...(provider.auths ?? []), newAuth] as any;
    storeRef.current.providers.set(providerId, provider);
    onAuthChange?.();
    saveProvidersToConfig(storeRef.current.providers);

    return c.json(
      {
        success: true,
        data: {
          key: accessToken,
          name: displayName,
          auth_type: "oauth",
          oauth_metadata: metadataJson,
          id,
          created_at: now,
          updated_at: now,
        },
      },
      201,
    );
  });

  // POST /api/config/reload
  router.post("/api/config/reload", async (c) => {
    if (!onReload) {
      return c.json(
        {
          success: false,
          error: "Config reload is not available",
        },
        501,
      );
    }

    try {
      const newConfig = await onReload();
      // Reset store from config
      storeRef.current.models = new Map(newConfig.models);
      storeRef.current.providers = new Map(newConfig.providers);

      const authCount = Array.from(newConfig.providers.values()).reduce(
        (sum, p) => sum + (p.auths ?? []).length,
        0,
      );

      return c.json({
        success: true,
        data: {
          models_count: newConfig.models.size,
          providers_count: newConfig.providers.size,
          auths_count: authCount,
          reloaded_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: `Config reload failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        500,
      );
    }
  });

  return router;
}

/**
 * Resolve model aliases — auto-create when alias is empty.
 */
function resolveModelAliases(
  models: Array<Record<string, unknown>>,
  modelsStore: Map<string, ModelAlias>,
  providerId?: string,
): Array<{ name: string; enabled?: boolean; weight?: number; alias?: string }> {
  return models.map((m) => {
    const modelName = m.name as string;
    const alias = (m.alias as string) ?? "";
    const result: Record<string, unknown> = { ...m };

    if (!alias || alias.trim() === "") {
      // Empty alias: find existing alias with same name as model, or create one
      const existingAlias = Array.from(modelsStore.values()).find(
        (a) => a.alias === modelName,
      );
      if (existingAlias) {
        result.alias = existingAlias.alias;
      } else if (providerId) {
        // Create a new alias with the model name, linked to this provider
        const newAlias: ModelAlias = {
          alias: modelName,
          strategy: "proportional",
          models: [{ provider_id: providerId, model_name: modelName }],
          queue_timeout: 30000,
          enabled: true,
        };
        modelsStore.set(modelName, newAlias);
        result.alias = modelName;
      }
    }

    return result as {
      name: string;
      enabled?: boolean;
      weight?: number;
      alias?: string;
    };
  });
}
