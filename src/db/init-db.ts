import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadConfig } from "../config.js";
import { openDatabase } from "./connection.js";

const config = loadConfig();
const databasePath = resolve(config.databasePath);
const schemaPath = resolve("src/db/schema.sql");

await mkdir(dirname(databasePath), { recursive: true });

const schema = await readFile(schemaPath, "utf8");
const database = openDatabase(databasePath);

database.exec(schema);
database.close();

console.log(`Initialized SQLite database at ${databasePath}`);
