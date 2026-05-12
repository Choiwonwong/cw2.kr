import type { DatabaseConnection } from "../db/connection.js";
import { booleanFromSqlite, booleanToSqlite } from "./row-mappers.js";

export type ScrapeSource = {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string | null;
};

type ScrapeSourceRow = {
  id: number;
  name: string;
  url: string;
  enabled: number;
  created_at: string;
  updated_at: string | null;
};

export type CreateScrapeSourceInput = {
  name: string;
  url: string;
  enabled?: boolean;
};

export type ScrapeSourceRepository = {
  create(input: CreateScrapeSourceInput): ScrapeSource;
  findEnabled(): ScrapeSource[];
  findById(id: number): ScrapeSource | null;
};

function toScrapeSource(row: ScrapeSourceRow): ScrapeSource {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    enabled: booleanFromSqlite(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createScrapeSourceRepository(
  database: DatabaseConnection
): ScrapeSourceRepository {
  const insertSource = database.prepare(`
    INSERT INTO scrape_sources (name, url, enabled)
    VALUES (@name, @url, @enabled)
  `);

  const findByIdStatement = database.prepare<number, ScrapeSourceRow>(`
    SELECT id, name, url, enabled, created_at, updated_at
    FROM scrape_sources
    WHERE id = ?
  `);

  const findEnabledStatement = database.prepare<[], ScrapeSourceRow>(`
    SELECT id, name, url, enabled, created_at, updated_at
    FROM scrape_sources
    WHERE enabled = 1
    ORDER BY id ASC
  `);

  return {
    create(input) {
      const result = insertSource.run({
        name: input.name,
        url: input.url,
        enabled: booleanToSqlite(input.enabled ?? true)
      });

      const source = this.findById(Number(result.lastInsertRowid));

      if (!source) {
        throw new Error("Failed to read created scrape source");
      }

      return source;
    },

    findEnabled() {
      return findEnabledStatement.all().map(toScrapeSource);
    },

    findById(id) {
      const row = findByIdStatement.get(id);

      return row ? toScrapeSource(row) : null;
    }
  };
}
