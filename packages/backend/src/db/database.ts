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
  auth_type: string; // "api_key" | "oauth" — defaults to "api_key"
  metadata: string | null; // JSON string for OAuth tokens
  created_at: string;
  updated_at: string;
}

export interface Database {
  request_logs: RequestLog;
  stats_aggregates: StatsAggregate;
  provider_auths: ProviderAuth;
  schema_versions: SchemaVersion;
}

export interface SchemaVersion {
  version: number;
  description: string;
  applied_at: string;
}

import { runMigrations, LATEST_SCHEMA_VERSION } from "./migrations.js";

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
    _dbPromise = createKyselyDb(dbPath);
  }
  return _dbPromise;
}

export async function initDb(dbPath?: string): Promise<void> {
  const db = await getDb(dbPath);

  // Run formal schema version management
  const result = await runMigrations(db);

  if (result.applied > 0) {
    console.log(
      `[db] Schema updated to v${result.currentVersion} (${result.applied} new migration(s))`,
    );
  } else {
    console.log(
      `[db] Schema at v${result.currentVersion} (${result.skipped} migrations skipped)`,
    );
  }
}

export async function closeDb(): Promise<void> {
  if (_dbPromise) {
    const db = await _dbPromise;
    await db.destroy();
    _dbPromise = null;
  }
}
