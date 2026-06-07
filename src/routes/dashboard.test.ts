import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../app.js";
import type { DatabaseConnection } from "../db/connection.js";
import { createHousingPostRepository } from "../repositories/housing-post-repository.js";
import { createScrapeRunRepository } from "../repositories/scrape-run-repository.js";
import { createScrapeSourceRepository } from "../repositories/scrape-source-repository.js";
import type { AppRepositories } from "../repositories/app-repositories.js";
import { createTestDatabase } from "../test/database.js";

let app: FastifyInstance;
let database: DatabaseConnection;
let repositories: AppRepositories;

beforeEach(async () => {
  database = createTestDatabase();
  repositories = {
    database,
    sources: createScrapeSourceRepository(database),
    runs: createScrapeRunRepository(database),
    housingPosts: createHousingPostRepository(database)
  };
  app = await buildApp({
    config: {
      port: 0,
      host: "127.0.0.1",
      version: "test",
      databasePath: ":memory:",
      discordWebhookUrl: null
    },
    repositories
  });
});

afterEach(async () => {
  await app.close();
  database.close();
});

describe("dashboard routes", () => {
  it("serves a no-content favicon response for browser chrome", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/favicon.ico"
    });

    assert.equal(response.statusCode, 204);
  });

  it("renders the overview dashboard", async () => {
    const source = repositories.sources.create({
      name: "더포디엄830 공지사항",
      url: "https://example.com/source"
    });
    const run = repositories.runs.create(source.id);
    repositories.runs.markSuccess(run.id, {
      foundCount: 16,
      newCount: 1,
      updatedCount: 2,
      duplicateCount: 13
    });
    repositories.housingPosts.insertIfNew({
      sourceId: source.id,
      firstSeenRunId: run.id,
      title: "신규 공고",
      url: "https://example.com/posts/1",
      isNotice: true,
      postedAt: "2026-06-07T00:00:00Z"
    });

    const response = await app.inject({
      method: "GET",
      url: "/"
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"] ?? "", /text\/html/);
    assert.match(response.body, /Housing Ops/);
    assert.match(response.body, /더포디엄830 공지사항/);
    assert.match(response.body, /신규 공고/);
    assert.match(response.body, /정상/);
    assert.match(response.body, /소스 상태/);
    assert.match(response.body, /발견/);
    assert.match(response.body, /업데이트/);
    assert.match(response.body, /13/);
  });

  it("renders disabled sources alongside enabled sources", async () => {
    repositories.sources.create({
      name: "enabled source",
      url: "https://example.com/enabled"
    });
    repositories.sources.create({
      name: "disabled source",
      url: "https://example.com/disabled",
      enabled: false
    });

    const response = await app.inject({
      method: "GET",
      url: "/"
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /enabled source/);
    assert.match(response.body, /disabled source/);
    assert.match(response.body, /비활성/);
  });

  it("renders housing posts and marks checked/submitted through form endpoints", async () => {
    const source = repositories.sources.create({
      name: "source",
      url: "https://example.com/source"
    });
    const inserted = repositories.housingPosts.insertIfNew({
      sourceId: source.id,
      title: "확인할 공고",
      url: "https://example.com/posts/1"
    });

    const page = await app.inject({
      method: "GET",
      url: "/housing-posts"
    });

    assert.equal(page.statusCode, 200);
    assert.match(page.body, /확인할 공고/);
    assert.match(page.body, /mark-checked/);
    assert.doesNotMatch(page.body, /mark-submitted/);

    const checked = await app.inject({
      method: "POST",
      url: `/api/housing-posts/${inserted.post.id}/mark-checked`
    });

    assert.equal(checked.statusCode, 303);
    assert.equal(checked.headers.location, "/housing-posts");
    assert.equal(repositories.housingPosts.findById(inserted.post.id)?.isChecked, true);

    const submitted = await app.inject({
      method: "POST",
      url: `/api/housing-posts/${inserted.post.id}/mark-submitted`
    });

    assert.equal(submitted.statusCode, 303);
    assert.equal(repositories.housingPosts.findById(inserted.post.id)?.isSubmitted, true);
  });

  it("filters housing posts by source, text, and workflow state", async () => {
    const sourceA = repositories.sources.create({
      name: "source A",
      url: "https://example.com/source-a"
    });
    const sourceB = repositories.sources.create({
      name: "source B",
      url: "https://example.com/source-b"
    });

    repositories.housingPosts.insertIfNew({
      sourceId: sourceA.id,
      title: "서울 청년안심주택 공고",
      url: "https://example.com/posts/seoul"
    });
    const checked = repositories.housingPosts.insertIfNew({
      sourceId: sourceB.id,
      title: "부산 공고",
      url: "https://example.com/posts/busan"
    });
    repositories.housingPosts.markChecked(checked.post.id);

    const response = await app.inject({
      method: "GET",
      url: `/housing-posts?source=${sourceA.id}&q=서울&checked=unchecked`
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /서울 청년안심주택 공고/);
    assert.doesNotMatch(response.body, /부산 공고/);
  });

  it("renders recent scrape runs", async () => {
    const source = repositories.sources.create({
      name: "source",
      url: "https://example.com/source"
    });
    const run = repositories.runs.create(source.id);

    repositories.runs.markFailed(run.id, "Network timeout");

    const response = await app.inject({
      method: "GET",
      url: "/runs"
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /Scrape runs/);
    assert.match(response.body, /실패/);
    assert.match(response.body, /Network timeout/);
  });

  it("filters scrape runs by status", async () => {
    const source = repositories.sources.create({
      name: "source",
      url: "https://example.com/source"
    });
    const success = repositories.runs.create(source.id);
    const failure = repositories.runs.create(source.id);

    repositories.runs.markSuccess(success.id);
    repositories.runs.markFailed(failure.id, "Network timeout");

    const response = await app.inject({
      method: "GET",
      url: "/runs?status=failed"
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /Network timeout/);
    assert.doesNotMatch(response.body, new RegExp(`#${success.id}</td>`));
  });
});
