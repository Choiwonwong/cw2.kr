import type { DatabaseConnection } from "../db/connection.js";

export type ScrapeRunStatus = "running" | "success" | "failed";

export type ScrapeRun = {
  id: number;
  sourceId: number;
  status: ScrapeRunStatus;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
};

type ScrapeRunRow = {
  id: number;
  source_id: number;
  status: ScrapeRunStatus;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

export type ScrapeRunRepository = {
  create(sourceId: number): ScrapeRun;
  markSuccess(id: number): ScrapeRun;
  markFailed(id: number, errorMessage: string): ScrapeRun;
  findById(id: number): ScrapeRun | null;
  findRecent(limit: number): ScrapeRun[];
  findRecentBySource(sourceId: number, limit: number): ScrapeRun[];
};

function toScrapeRun(row: ScrapeRunRow): ScrapeRun {
  return {
    id: row.id,
    sourceId: row.source_id,
    status: row.status,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at
  };
}

export function createScrapeRunRepository(
  database: DatabaseConnection
): ScrapeRunRepository {
  const insertRun = database.prepare(`
    INSERT INTO scrape_runs (source_id, status)
    VALUES (?, 'running')
  `);

  const markSuccessStatement = database.prepare(`
    UPDATE scrape_runs
    SET status = 'success', error_message = NULL, finished_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const markFailedStatement = database.prepare(`
    UPDATE scrape_runs
    SET status = 'failed', error_message = ?, finished_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const findByIdStatement = database.prepare<number, ScrapeRunRow>(`
    SELECT id, source_id, status, error_message, started_at, finished_at, created_at
    FROM scrape_runs
    WHERE id = ?
  `);

  const findRecentBySourceStatement = database.prepare<[number, number], ScrapeRunRow>(`
    SELECT id, source_id, status, error_message, started_at, finished_at, created_at
    FROM scrape_runs
    WHERE source_id = ?
    ORDER BY id DESC
    LIMIT ?
  `);

  const findRecentStatement = database.prepare<number, ScrapeRunRow>(`
    SELECT id, source_id, status, error_message, started_at, finished_at, created_at
    FROM scrape_runs
    ORDER BY id DESC
    LIMIT ?
  `);

  function requireRun(id: number): ScrapeRun {
    const run = findByIdStatement.get(id);

    if (!run) {
      throw new Error(`Scrape run not found: ${id}`);
    }

    return toScrapeRun(run);
  }

  return {
    create(sourceId) {
      const result = insertRun.run(sourceId);

      return requireRun(Number(result.lastInsertRowid));
    },

    markSuccess(id) {
      markSuccessStatement.run(id);

      return requireRun(id);
    },

    markFailed(id, errorMessage) {
      markFailedStatement.run(errorMessage, id);

      return requireRun(id);
    },

    findById(id) {
      const row = findByIdStatement.get(id);

      return row ? toScrapeRun(row) : null;
    },

    findRecent(limit) {
      return findRecentStatement.all(limit).map(toScrapeRun);
    },

    findRecentBySource(sourceId, limit) {
      return findRecentBySourceStatement.all(sourceId, limit).map(toScrapeRun);
    }
  };
}
