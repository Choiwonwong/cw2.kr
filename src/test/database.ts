import { readFileSync } from "node:fs";

import { openDatabase, type DatabaseConnection } from "../db/connection.js";

export function createTestDatabase(): DatabaseConnection {
  const database = openDatabase(":memory:");
  const schema = readFileSync("src/db/schema.sql", "utf8");

  database.exec(schema);

  return database;
}
