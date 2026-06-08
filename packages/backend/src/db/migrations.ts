import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "./database.js";

// ============================================================
// LLM Proxy Gateway — Database Migration System
// ============================================================
//
// IMPORTANT: Schema version compatibility
//
// The app declares LATEST_SCHEMA_VERSION at compile time. On startup,
// initDb() compares it against the version stored in the schema_versions
// table. If the DB's version is HIGHER than the app's, the app is too old
// and will refuse to start — the user must update the app first.
//
// Migration files are added to the MIGRATIONS array. Never renumber or
// alter existing migrations — the version must monotonically increase.
//
// When you add a new migration:
//   1. Append to the MIGRATIONS array with version = last + 1
//   2. Update LATEST_SCHEMA_VERSION to match
//   3. Keep it idempotent (use columnExists helper for column additions)
//
// Compatibility:
//   - App declares: "I understand schema versions 1..LATEST_SCHEMA_VERSION"
//   - DB records: "My schema is at version N"
//   - If N > LATEST_SCHEMA_VERSION: old app → refuse to open DB
//   - If N <= LATEST_SCHEMA_VERSION: app can handle it → run pending
// ============================================================

/** Bump this when you add a new migration */
export const LATEST_SCHEMA_VERSION = 1;

interface MigrationDefinition {
  version: number;
  description: string;
  apply: (db: Kysely<Database>) => Promise<void>;
}

// ============================================================
// Helper: check if a column exists in a table (SQLite PRAGMA)
// ============================================================

async function columnExists(
  db: Kysely<Database>,
  table: string,
  col: string,
): Promise<boolean> {
  try {
    const result = await sql<{ name: string }>`
      SELECT name FROM pragma_table_info(${table})
    `.execute(db);
    return result.rows.some((r) => r.name === col);
  } catch {
    return false;
  }
}

// ============================================================
// Schema version I/O
// ============================================================

async function ensureSchemaVersionsTable(
  db: Kysely<Database>,
): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS schema_versions (
    version INTEGER NOT NULL,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`.execute(db);
}

async function getCurrentVersion(
  db: Kysely<Database>,
): Promise<number> {
  try {
    const result = await sql<{ max_version: number | null }>`
      SELECT MAX(version) AS max_version FROM schema_versions
    `.execute(db);
    return result.rows[0]?.max_version ?? 0;
  } catch {
    return 0;
  }
}

async function recordMigration(
  db: Kysely<Database>,
  version: number,
  description: string,
): Promise<void> {
  await sql`
    INSERT INTO schema_versions (version, description, applied_at)
    VALUES (${version}, ${description}, ${new Date().toISOString()})
  `.execute(db);
}

// ============================================================
// Migrations
// ============================================================

const MIGRATIONS: MigrationDefinition[] = [
  {
    version: 1,
    description:
      "Initial schema: request_logs, provider_auths, stats_aggregates + indexes",
    apply: async (db) => {
      // ── request_logs ──
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
        .addColumn("input_tokens", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("output_tokens", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("cache_tokens", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("total_tokens", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("latency_ms", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("error_message", "text")
        .addColumn("rate_limited_by", "text")
        .execute();

      // Add cache_hit_tokens if not exists (compatibility with old DBs)
      if (!(await columnExists(db, "request_logs", "cache_hit_tokens"))) {
        await db.schema
          .alterTable("request_logs")
          .addColumn("cache_hit_tokens", "integer", (c) =>
            c.notNull().defaultTo(0),
          )
          .execute();
      }

      // Add cache_create_tokens if not exists
      if (!(await columnExists(db, "request_logs", "cache_create_tokens"))) {
        await db.schema
          .alterTable("request_logs")
          .addColumn("cache_create_tokens", "integer", (c) =>
            c.notNull().defaultTo(0),
          )
          .execute();
      }

      // ── request_logs indexes ──
      for (const [idxName, col] of [
        ["idx_request_logs_timestamp", "timestamp"],
        ["idx_request_logs_auth_key", "auth_key"],
        ["idx_request_logs_provider_id", "provider_id"],
        ["idx_request_logs_model_alias", "model_alias"],
        ["idx_request_logs_status", "status"],
      ] as const) {
        await db.schema
          .createIndex(idxName)
          .ifNotExists()
          .on("request_logs")
          .column(col)
          .execute();
      }

      // ── provider_auths ──
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

      // Add auth_type if not exists (compatibility with old DBs)
      if (!(await columnExists(db, "provider_auths", "auth_type"))) {
        await db.schema
          .alterTable("provider_auths")
          .addColumn("auth_type", "text", (c) =>
            c.notNull().defaultTo("api_key"),
          )
          .execute();
      }

      // Add metadata if not exists
      if (!(await columnExists(db, "provider_auths", "metadata"))) {
        await db.schema
          .alterTable("provider_auths")
          .addColumn("metadata", "text")
          .execute();
      }

      await db.schema
        .createIndex("idx_provider_auths_provider_id")
        .ifNotExists()
        .on("provider_auths")
        .column("provider_id")
        .execute();

      // ── stats_aggregates ──
      await db.schema
        .createTable("stats_aggregates")
        .ifNotExists()
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("timestamp", "text", (col) => col.notNull())
        .addColumn("granularity", "text", (col) => col.notNull())
        .addColumn("auth_key", "text", (col) => col.notNull())
        .addColumn("provider_id", "text", (col) => col.notNull())
        .addColumn("model_alias", "text", (col) => col.notNull())
        .addColumn("request_count", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("success_count", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("error_count", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("rate_limited_count", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("input_tokens", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("output_tokens", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("cache_tokens", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("total_tokens", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .execute();

      for (const [idxName, col] of [
        ["idx_stats_aggregates_timestamp", "timestamp"],
        ["idx_stats_aggregates_granularity", "granularity"],
        ["idx_stats_aggregates_auth_key", "auth_key"],
      ] as const) {
        await db.schema
          .createIndex(idxName)
          .ifNotExists()
          .on("stats_aggregates")
          .column(col)
          .execute();
      }
    },
  },
];

// ============================================================
// Migration runner
// ============================================================

export interface MigrationResult {
  applied: number;
  skipped: number;
  currentVersion: number;
}

/**
 * Run all pending migrations.
 *
 * IMPORTANT: If the DB schema version is HIGHER than LATEST_SCHEMA_VERSION,
 * the app is too old and must be updated. Throws an error.
 */
export async function runMigrations(
  db: Kysely<Database>,
): Promise<MigrationResult> {
  await ensureSchemaVersionsTable(db);
  const currentVersion = await getCurrentVersion(db);

  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `数据库 schema 版本 (v${currentVersion}) 高于本应用支持的版本 (v${LATEST_SCHEMA_VERSION})。` +
        `请升级 LLM Proxy Gateway 到最新版本。`,
    );
  }

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version,
  );

  let applied = 0;
  for (const migration of pending) {
    console.log(
      `[db] Applying migration v${migration.version}: ${migration.description}`,
    );
    try {
      await migration.apply(db);
      await recordMigration(db, migration.version, migration.description);
      applied++;
      console.log(`[db] Migration v${migration.version} applied successfully`);
    } catch (err) {
      console.error(
        `[db] Migration v${migration.version} FAILED:`,
        err instanceof Error ? err.message : err,
      );
      throw err;
    }
  }

  return {
    applied,
    skipped: MIGRATIONS.length - pending.length,
    currentVersion: currentVersion + applied,
  };
}
