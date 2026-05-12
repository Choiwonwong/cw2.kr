import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { DatabaseConnection } from "../db/connection.js";
import { createHousingPostRepository } from "../repositories/housing-post-repository.js";
import { createScrapeRunRepository } from "../repositories/scrape-run-repository.js";
import { createScrapeSourceRepository } from "../repositories/scrape-source-repository.js";
import { createTestDatabase } from "../test/database.js";
import {
  createScrapeService,
  type HousingScraper,
  type ScrapeServiceRepositories
} from "./scrape-service.js";

let database: DatabaseConnection;
let repositories: ScrapeServiceRepositories;

beforeEach(() => {
  database = createTestDatabase();
  repositories = {
    sources: createScrapeSourceRepository(database),
    runs: createScrapeRunRepository(database),
    housingPosts: createHousingPostRepository(database)
  };
});

afterEach(() => {
  database.close();
});

describe("scrape service", () => {
  it("runs enabled housing scrapers and stores only new posts", async () => {
    const source = repositories.sources.create({
      name: "청약홈",
      url: "https://example.com/housing"
    });
    const scraper: HousingScraper = {
      sourceId: source.id,
      scrape: async () => [
        {
          title: "첫 번째 청약 공고",
          url: "https://example.com/posts/1",
          isNotice: true
        },
        {
          title: "두 번째 청약 공고",
          url: "https://example.com/posts/2",
          isNotice: true
        }
      ]
    };
    const service = createScrapeService(repositories);

    const firstResult = await service.runHousingScraper(scraper);
    const secondResult = await service.runHousingScraper(scraper);

    assert.equal(firstResult.status, "success");
    assert.equal(firstResult.foundCount, 2);
    assert.equal(firstResult.newCount, 2);
    assert.equal(firstResult.duplicateCount, 0);

    assert.equal(secondResult.status, "success");
    assert.equal(secondResult.foundCount, 2);
    assert.equal(secondResult.newCount, 0);
    assert.equal(secondResult.duplicateCount, 2);

    assert.equal(repositories.housingPosts.findRecent(10).length, 2);

    const runs = repositories.runs.findRecentBySource(source.id, 2);
    assert.deepEqual(
      runs.map((run) => run.status),
      ["success", "success"]
    );
  });

  it("marks the scrape run as failed when the scraper throws", async () => {
    const source = repositories.sources.create({
      name: "청약홈",
      url: "https://example.com/housing"
    });
    const scraper: HousingScraper = {
      sourceId: source.id,
      scrape: async () => {
        throw new Error("Request failed");
      }
    };
    const service = createScrapeService(repositories);

    const result = await service.runHousingScraper(scraper);

    assert.equal(result.status, "failed");
    assert.equal(result.foundCount, 0);
    assert.equal(result.newCount, 0);
    assert.equal(result.duplicateCount, 0);
    assert.match(result.errorMessage ?? "", /Request failed/);

    const runs = repositories.runs.findRecentBySource(source.id, 1);
    assert.equal(runs[0]?.status, "failed");
    assert.equal(runs[0]?.errorMessage, "Request failed");
  });

  it("calculates source health from recent run history", async () => {
    const source = repositories.sources.create({
      name: "청약홈",
      url: "https://example.com/housing"
    });
    const service = createScrapeService(repositories);

    assert.equal(service.getSourceHealth(source.id), "unknown");

    const successfulScraper: HousingScraper = {
      sourceId: source.id,
      scrape: async () => []
    };
    await service.runHousingScraper(successfulScraper);
    assert.equal(service.getSourceHealth(source.id), "healthy");

    const failingScraper: HousingScraper = {
      sourceId: source.id,
      scrape: async () => {
        throw new Error("temporary failure");
      }
    };
    await service.runHousingScraper(failingScraper);
    assert.equal(service.getSourceHealth(source.id), "degraded");

    await service.runHousingScraper(failingScraper);
    assert.equal(service.getSourceHealth(source.id), "degraded");

    await service.runHousingScraper(failingScraper);
    assert.equal(service.getSourceHealth(source.id), "unhealthy");
  });
});
