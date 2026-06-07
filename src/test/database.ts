import { openDatabase, type DatabaseConnection } from "../db/connection.js";
import { initializeDatabaseSchema } from "../db/schema.js";

export function createTestDatabase(): DatabaseConnection {
  const database = openDatabase(":memory:");

  initializeDatabaseSchema(database);

  return database;
}
