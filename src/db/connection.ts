import Database from "better-sqlite3";

export type DatabaseConnection = Database.Database;

export function openDatabase(databasePath: string): DatabaseConnection {
  const database = new Database(databasePath);

  database.pragma("foreign_keys = ON");

  return database;
}
