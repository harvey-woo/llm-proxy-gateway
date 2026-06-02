import { SqliteDialect } from "kysely";
import type { Dialect } from "kysely";

/**
 * Runtime-appropriate SQLite dialect.
 *
 * In Bun: uses bun:sqlite + kysely-bun-sqlite (native, no C++ addon).
 * In Node: uses better-sqlite3 via standard SqliteDialect.
 *
 * Only this file touches those packages directly.
 */
export async function createDialect(dbPath: string): Promise<Dialect> {
  const isBun = typeof Bun !== "undefined";

  if (isBun) {
    const { Database: BunDatabase } = await import("bun:sqlite");
    const { BunSqliteDialect } = await import("kysely-bun-sqlite");

    const bunDb = new BunDatabase(dbPath);
    bunDb.exec("PRAGMA journal_mode = WAL");
    bunDb.exec("PRAGMA synchronous = NORMAL");

    return new BunSqliteDialect({ database: bunDb });
  }

  const { default: Database } = await import("better-sqlite3");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");

  return new SqliteDialect({ database: sqlite });
}
