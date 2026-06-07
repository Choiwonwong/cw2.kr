import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadConfig } from "../config.js";
import { openDatabase } from "./connection.js";
import { initializeDatabaseSchema } from "./schema.js";

const config = loadConfig();
const databasePath = resolve(config.databasePath);

await mkdir(dirname(databasePath), { recursive: true });

const database = openDatabase(databasePath);

initializeDatabaseSchema(database);
database.close();

console.log(`Initialized SQLite database at ${databasePath}`);
