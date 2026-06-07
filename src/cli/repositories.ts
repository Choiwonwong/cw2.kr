import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

import type { AppConfig } from "../config.js";
import { openDatabase, type DatabaseConnection } from "../db/connection.js";
import { initializeDatabaseSchema } from "../db/schema.js";
import { createHousingPostRepository } from "../repositories/housing-post-repository.js";
import { createScrapeRunRepository } from "../repositories/scrape-run-repository.js";
import { createScrapeSourceRepository } from "../repositories/scrape-source-repository.js";
import type { ScrapeServiceRepositories } from "../services/scrape-service.js";

export type CliRepositories = ScrapeServiceRepositories & {
  database: DatabaseConnection;
};

export function openCliRepositories(config: AppConfig): CliRepositories {
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
