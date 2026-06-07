import type { DatabaseConnection } from "../db/connection.js";

export type ScrapeRunStatus = "running" | "success" | "failed";

export type ScrapeRun = {
  id: number;
  sourceId: number;
  status: ScrapeRunStatus;
  errorMessage: string | null;
  foundCount: number;
  newCount: number;
  updatedCount: number;
  duplicateCount: number;
  notificationErrorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
};

type ScrapeRunRow = {
  id: number;
  source_id: number;
  status: ScrapeRunStatus;
  error_message: string | null;
  found_count: number;
  new_count: number;
  updated_count: number;
  duplicate_count: number;
  notification_error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

export type MarkScrapeRunSuccessInput = {
  foundCount?: number;
  newCount?: number;
  updatedCount?: number;
  duplicateCount?: number;
  notificationErrorMessage?: string | null;
};

export type ScrapeRunRepository = {
  create(sourceId: number): ScrapeRun;
  markSuccess(id: number, input?: MarkScrapeRunSuccessInput): ScrapeRun;
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
    foundCount: row.found_count,
    newCount: row.new_count,
    updatedCount: row.updated_count,
    duplicateCount: row.duplicate_count,
    notificationErrorMessage: row.notification_error_message,
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
    SET
      status = 'success',
      error_message = NULL,
      found_count = @foundCount,
      new_count = @newCount,
      updated_count = @updatedCount,
      duplicate_count = @duplicateCount,
      notification_error_message = @notificationErrorMessage,
      finished_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  const markFailedStatement = database.prepare(`
    UPDATE scrape_runs
    SET status = 'failed', error_message = ?, finished_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const findByIdStatement = database.prepare<number, ScrapeRunRow>(`
    SELECT
      id,
      source_id,
      status,
      error_message,
      found_count,
      new_count,
      updated_count,
      duplicate_count,
      notification_error_message,
      started_at,
      finished_at,
      created_at
    FROM scrape_runs
    WHERE id = ?
  `);

  const findRecentBySourceStatement = database.prepare<[number, number], ScrapeRunRow>(`
    SELECT
      id,
      source_id,
      status,
      error_message,
      found_count,
      new_count,
      updated_count,
      duplicate_count,
      notification_error_message,
      started_at,
      finished_at,
      created_at
    FROM scrape_runs
    WHERE source_id = ?
    ORDER BY id DESC
    LIMIT ?
  `);

  const findRecentStatement = database.prepare<number, ScrapeRunRow>(`
    SELECT
      id,
      source_id,
      status,
      error_message,
      found_count,
      new_count,
      updated_count,
      duplicate_count,
      notification_error_message,
      started_at,
      finished_at,
      created_at
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

    markSuccess(id, input = {}) {
      markSuccessStatement.run({
        id,
        foundCount: input.foundCount ?? 0,
        newCount: input.newCount ?? 0,
        updatedCount: input.updatedCount ?? 0,
        duplicateCount: input.duplicateCount ?? 0,
        notificationErrorMessage: input.notificationErrorMessage ?? null
      });

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
