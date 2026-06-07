import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { AppConfig } from "../config.js";
import { openDatabase, type DatabaseConnection } from "../db/connection.js";
import { initializeDatabaseSchema } from "../db/schema.js";
import { createHousingPostRepository } from "./housing-post-repository.js";
import { createScrapeRunRepository } from "./scrape-run-repository.js";
import { createScrapeSourceRepository } from "./scrape-source-repository.js";
import type { ScrapeServiceRepositories } from "../services/scrape-service.js";

export type AppRepositories = ScrapeServiceRepositories & {
  database: DatabaseConnection;
};

export function openAppRepositories(config: AppConfig): AppRepositories {
  const databasePath = resolve(config.databasePath);

  mkdirSync(dirname(databasePath), { recursive: true });

  const database = openDatabase(databasePath);
  initializeDatabaseSchema(database);

  return {
    database,
    sources: createScrapeSourceRepository(database),
    runs: createScrapeRunRepository(database),
    housingPosts: createHousingPostRepository(database)
  };
}
