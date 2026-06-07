import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { createTestDatabase } from "../test/database.js";
import type { DatabaseConnection } from "../db/connection.js";
import { createScrapeRunRepository } from "./scrape-run-repository.js";
import { createScrapeSourceRepository } from "./scrape-source-repository.js";

let database: DatabaseConnection;

beforeEach(() => {
  database = createTestDatabase();
});

afterEach(() => {
  database.close();
});

describe("scrape run repository", () => {
  it("creates a running scrape run", () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const runRepository = createScrapeRunRepository(database);
    const source = sourceRepository.create({ name: "source", url: "https://example.com" });

    const run = runRepository.create(source.id);

    assert.equal(run.id, 1);
    assert.equal(run.sourceId, source.id);
    assert.equal(run.status, "running");
    assert.equal(run.errorMessage, null);
    assert.equal(run.foundCount, 0);
    assert.equal(run.newCount, 0);
    assert.equal(run.updatedCount, 0);
    assert.equal(run.duplicateCount, 0);
    assert.equal(run.notificationErrorMessage, null);
    assert.equal(typeof run.startedAt, "string");
    assert.equal(run.finishedAt, null);
  });

  it("marks a run as success", () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const runRepository = createScrapeRunRepository(database);
    const source = sourceRepository.create({ name: "source", url: "https://example.com" });
    const run = runRepository.create(source.id);

    const updated = runRepository.markSuccess(run.id, {
      foundCount: 16,
      newCount: 1,
      updatedCount: 2,
      duplicateCount: 13,
      notificationErrorMessage: "Discord failed"
    });

    assert.equal(updated.status, "success");
    assert.equal(updated.errorMessage, null);
    assert.equal(updated.foundCount, 16);
    assert.equal(updated.newCount, 1);
    assert.equal(updated.updatedCount, 2);
    assert.equal(updated.duplicateCount, 13);
    assert.equal(updated.notificationErrorMessage, "Discord failed");
    assert.equal(typeof updated.finishedAt, "string");
  });

  it("marks a run as failed with an error message", () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const runRepository = createScrapeRunRepository(database);
    const source = sourceRepository.create({ name: "source", url: "https://example.com" });
    const run = runRepository.create(source.id);

    const updated = runRepository.markFailed(run.id, "Network timeout");

    assert.equal(updated.status, "failed");
    assert.equal(updated.errorMessage, "Network timeout");
    assert.equal(typeof updated.finishedAt, "string");
  });

  it("finds recent runs for a source", () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const runRepository = createScrapeRunRepository(database);
    const source = sourceRepository.create({ name: "source", url: "https://example.com" });

    const first = runRepository.create(source.id);
    const second = runRepository.create(source.id);

    const runs = runRepository.findRecentBySource(source.id, 1);

    assert.deepEqual(
      runs.map((run) => run.id),
      [second.id]
    );
    assert.notEqual(first.id, second.id);
  });

  it("finds recent runs across all sources", () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const runRepository = createScrapeRunRepository(database);
    const firstSource = sourceRepository.create({
      name: "source-1",
      url: "https://example.com/1"
    });
    const secondSource = sourceRepository.create({
      name: "source-2",
      url: "https://example.com/2"
    });

    const first = runRepository.create(firstSource.id);
    const second = runRepository.create(secondSource.id);

    runRepository.markSuccess(first.id);
    runRepository.markFailed(second.id, "failed");

    assert.deepEqual(
      runRepository.findRecent(2).map((run) => run.id),
      [second.id, first.id]
    );
  });
});
