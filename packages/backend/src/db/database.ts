import { Kysely } from "kysely";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { createDialect } from "./dialect.js";

// ============================================================
// Database types for Kysely
// ============================================================

export interface RequestLog {
  id: string;
  timestamp: string;
  auth_key: string;
  provider_id: string;
  model_alias: string;
  real_model: string;
  format: string;
  status: "success" | "error" | "rate_limited" | "queued" | "timeout";
  input_tokens: number;
  output_tokens: number;
  cache_tokens: number;
  cache_hit_tokens: number;
  cache_create_tokens: number;
  total_tokens: number;
  latency_ms: number;
  error_message: string | null;
  rate_limited_by: string | null;
}

export interface StatsAggregate {
  id: string;
  timestamp: string;
  granularity: string;
  auth_key: string;
  provider_id: string;
  model_alias: string;
  request_count: number;
  success_count: number;
  error_count: number;
  rate_limited_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_tokens: number;
  total_tokens: number;
}

export interface ProviderAuth {
  id: string;
  provider_id: string;
  key: string;
  name: string | null;
  auth_type: string;       // "api_key" | "oauth" — defaults to "api_key"
  metadata: string | null; // JSON string for OAuth tokens
  created_at: string;
  updated_at: string;
}

export interface Database {
  request_logs: RequestLog;
  stats_aggregates: StatsAggregate;
  provider_auths: ProviderAuth;
}

// ============================================================
// Database initialization — async, works on both Bun and Node
// ============================================================

let _dbPromise: Promise<Kysely<Database>> | null = null;

function getDbPath(overrides?: { dbPath?: string }): string {
  if (overrides?.dbPath) return overrides.dbPath;
  const envPath = process.env.DB_PATH;
  if (envPath) return envPath;
  return join(process.cwd(), "data", "gateway.db");
}

async function createKyselyDb(dbPath?: string): Promise<Kysely<Database>> {
  const resolved = getDbPath({ dbPath });

  const dbDir = dirname(resolved);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const dialect = await createDialect(resolved);
  return new Kysely<Database>({ dialect });
}

export async function getDb(dbPath?: string): Promise<Kysely<Database>> {
  if (!_dbPromise) {
    _dbPromise = createKyselyDb(dbPath).then((db) => {
      void initDb().catch((err) => console.error("[db] auto-init failed:", err));
      return db;
    });
  }
  return _dbPromise;
}

export async function initDb(dbPath?: string): Promise<void> {
  const db = await getDb(dbPath);

  await db.schema
    .createTable("request_logs")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("timestamp", "text", (col) => col.notNull())
    .addColumn("auth_key", "text", (col) => col.notNull())
    .addColumn("provider_id", "text", (col) => col.notNull())
    .addColumn("model_alias", "text", (col) => col.notNull())
    .addColumn("real_model", "text", (col) => col.notNull())
    .addColumn("format", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("input_tokens", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("output_tokens", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("cache_tokens", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("cache_hit_tokens", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("cache_create_tokens", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("total_tokens", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("latency_ms", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("error_message", "text")
    .addColumn("rate_limited_by", "text")
    .execute();

  await db.schema
    .createIndex("idx_request_logs_timestamp")
    .ifNotExists()
    .on("request_logs")
    .column("timestamp")
    .execute();

  // Migration: add cache_hit_tokens and cache_create_tokens if missing
  for (const col of ["cache_hit_tokens", "cache_create_tokens"]) {
    try {
      await db.schema.alterTable("request_logs")
        .addColumn(col, "integer", (c) => c.notNull().defaultTo(0))
        .execute();
    } catch { /* already exists */ }
  }

  await db.schema
    .createIndex("idx_request_logs_auth_key")
    .ifNotExists()
    .on("request_logs")
    .column("auth_key")
    .execute();

  await db.schema
    .createIndex("idx_request_logs_provider_id")
    .ifNotExists()
    .on("request_logs")
    .column("provider_id")
    .execute();

  await db.schema
    .createIndex("idx_request_logs_model_alias")
    .ifNotExists()
    .on("request_logs")
    .column("model_alias")
    .execute();

  await db.schema
    .createIndex("idx_request_logs_status")
    .ifNotExists()
    .on("request_logs")
    .column("status")
    .execute();

  await db.schema
    .createTable("provider_auths")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("provider_id", "text", (col) => col.notNull())
    .addColumn("key", "text", (col) => col.notNull())
    .addColumn("name", "text")
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_provider_auths_provider_id")
    .ifNotExists()
    .on("provider_auths")
    .column("provider_id")
    .execute();

  // Migration: add auth_type and metadata columns (for OAuth support)
  // auth_type defaults to "api_key" — existing records are automatically compatible
  for (const col of ["auth_type"]) {
    try {
      await db.schema
        .alterTable("provider_auths")
        .addColumn(col, "text", (c) => c.notNull().defaultTo("api_key"))
        .execute();
    } catch { /* already exists */ }
  }
  try {
    await db.schema
      .alterTable("provider_auths")
      .addColumn("metadata", "text")
      .execute();
  } catch { /* already exists */ }

  await db.schema
    .createTable("stats_aggregates")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("timestamp", "text", (col) => col.notNull())
    .addColumn("granularity", "text", (col) => col.notNull())
    .addColumn("auth_key", "text", (col) => col.notNull())
    .addColumn("provider_id", "text", (col) => col.notNull())
    .addColumn("model_alias", "text", (col) => col.notNull())
    .addColumn("request_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("success_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("error_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("rate_limited_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("input_tokens", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("output_tokens", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("cache_tokens", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("total_tokens", "integer", (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema
    .createIndex("idx_stats_aggregates_timestamp")
    .ifNotExists()
    .on("stats_aggregates")
    .column("timestamp")
    .execute();

  await db.schema
    .createIndex("idx_stats_aggregates_granularity")
    .ifNotExists()
    .on("stats_aggregates")
    .column("granularity")
    .execute();

  await db.schema
    .createIndex("idx_stats_aggregates_auth_key")
    .ifNotExists()
    .on("stats_aggregates")
    .column("auth_key")
    .execute();
}

export async function closeDb(): Promise<void> {
  if (_dbPromise) {
    const db = await _dbPromise;
    await db.destroy();
    _dbPromise = null;
  }
}
