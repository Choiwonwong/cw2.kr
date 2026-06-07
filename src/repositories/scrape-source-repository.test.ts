import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { createTestDatabase } from "../test/database.js";
import type { DatabaseConnection } from "../db/connection.js";
import { createScrapeSourceRepository } from "./scrape-source-repository.js";

let database: DatabaseConnection;

beforeEach(() => {
  database = createTestDatabase();
});

afterEach(() => {
  database.close();
});

describe("scrape source repository", () => {
  it("creates a source with enabled=true by default", () => {
    const repository = createScrapeSourceRepository(database);

    const source = repository.create({
      name: "청약홈 공고",
      url: "https://example.com/housing"
    });

    assert.equal(source.id, 1);
    assert.equal(source.name, "청약홈 공고");
    assert.equal(source.url, "https://example.com/housing");
    assert.equal(source.enabled, true);
    assert.equal(typeof source.createdAt, "string");
    assert.equal(source.updatedAt, null);
  });

  it("finds only enabled sources", () => {
    const repository = createScrapeSourceRepository(database);

    const enabled = repository.create({
      name: "enabled source",
      url: "https://example.com/enabled"
    });

    repository.create({
      name: "disabled source",
      url: "https://example.com/disabled",
      enabled: false
    });

    const sources = repository.findEnabled();

    assert.deepEqual(
      sources.map((source) => source.id),
      [enabled.id]
    );
  });

  it("finds a source by URL", () => {
    const repository = createScrapeSourceRepository(database);
    const source = repository.create({
      name: "더포디엄830",
      url: "https://thepodium830.com/center/notice?isNotice=false&searchKey=all&searchValue&page=1"
    });

    assert.equal(repository.findByUrl(source.url)?.id, source.id);
    assert.equal(repository.findByUrl("https://example.com/missing"), null);
  });
});
