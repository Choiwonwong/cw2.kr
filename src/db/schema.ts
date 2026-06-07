import { readFileSync } from "node:fs";

import type { DatabaseConnection } from "./connection.js";

export function readDatabaseSchema(): string {
  return readFileSync("src/db/schema.sql", "utf8");
}

export function initializeDatabaseSchema(database: DatabaseConnection): void {
  database.exec(readDatabaseSchema());
}
