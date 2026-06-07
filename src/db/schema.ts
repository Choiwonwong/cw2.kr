import { readFileSync } from "node:fs";

import type { DatabaseConnection } from "./connection.js";

type TableInfoRow = {
  name: string;
};

const scrapeRunColumnMigrations = [
  {
    name: "found_count",
    sql: "ALTER TABLE scrape_runs ADD COLUMN found_count INTEGER NOT NULL DEFAULT 0"
  },
  {
    name: "new_count",
    sql: "ALTER TABLE scrape_runs ADD COLUMN new_count INTEGER NOT NULL DEFAULT 0"
  },
  {
    name: "updated_count",
    sql: "ALTER TABLE scrape_runs ADD COLUMN updated_count INTEGER NOT NULL DEFAULT 0"
  },
  {
    name: "duplicate_count",
    sql: "ALTER TABLE scrape_runs ADD COLUMN duplicate_count INTEGER NOT NULL DEFAULT 0"
  },
  {
    name: "notification_error_message",
    sql: "ALTER TABLE scrape_runs ADD COLUMN notification_error_message TEXT"
  }
];

export function readDatabaseSchema(): string {
  return readFileSync("src/db/schema.sql", "utf8");
}

function ensureScrapeRunColumns(database: DatabaseConnection): void {
  const rows = database.prepare<[], TableInfoRow>("PRAGMA table_info(scrape_runs)").all();
  const existingColumns = new Set(rows.map((row) => row.name));

  for (const migration of scrapeRunColumnMigrations) {
    if (!existingColumns.has(migration.name)) {
      database.exec(migration.sql);
    }
  }
}

export function initializeDatabaseSchema(database: DatabaseConnection): void {
  database.exec(readDatabaseSchema());
  ensureScrapeRunColumns(database);
}
