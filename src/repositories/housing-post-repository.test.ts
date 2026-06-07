import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { createTestDatabase } from "../test/database.js";
import type { DatabaseConnection } from "../db/connection.js";
import { createHousingPostRepository } from "./housing-post-repository.js";
import { createScrapeRunRepository } from "./scrape-run-repository.js";
import { createScrapeSourceRepository } from "./scrape-source-repository.js";

let database: DatabaseConnection;

beforeEach(() => {
  database = createTestDatabase();
});

afterEach(() => {
  database.close();
});

describe("housing post repository", () => {
  it("inserts a new housing post", () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const runRepository = createScrapeRunRepository(database);
    const postRepository = createHousingPostRepository(database);
    const source = sourceRepository.create({ name: "source", url: "https://example.com" });
    const run = runRepository.create(source.id);

    const result = postRepository.insertIfNew({
      sourceId: source.id,
      firstSeenRunId: run.id,
      sourceSeq: 1,
      externalId: "A-1",
      title: "첫 번째 청약 공고",
      description: "요약",
      url: "https://example.com/posts/1",
      isNotice: true,
      postedAt: "2026-05-13T00:00:00Z",
      attachmentsJson: JSON.stringify([{ name: "notice.pdf", url: "https://example.com/notice.pdf" }])
    });

    assert.equal(result.inserted, true);
    assert.equal(result.post.id, 1);
    assert.equal(result.post.sourceId, source.id);
    assert.equal(result.post.firstSeenRunId, run.id);
    assert.equal(result.post.isNotice, true);
    assert.equal(result.post.isChecked, false);
    assert.equal(result.post.isSubmitted, false);
    assert.equal(result.post.notifiedAt, null);
  });

  it("does not insert duplicates for the same source and URL", () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const postRepository = createHousingPostRepository(database);
    const source = sourceRepository.create({ name: "source", url: "https://example.com" });

    const first = postRepository.insertIfNew({
      sourceId: source.id,
      title: "원본 제목",
      url: "https://example.com/posts/1"
    });

    const second = postRepository.insertIfNew({
      sourceId: source.id,
      title: "변경된 제목",
      url: "https://example.com/posts/1"
    });

    assert.equal(first.inserted, true);
    assert.equal(second.inserted, false);
    assert.equal(second.post.id, first.post.id);
    assert.equal(second.post.title, "원본 제목");
  });

  it("marks posts as checked and submitted", () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const postRepository = createHousingPostRepository(database);
    const source = sourceRepository.create({ name: "source", url: "https://example.com" });
    const inserted = postRepository.insertIfNew({
      sourceId: source.id,
      title: "청약 공고",
      url: "https://example.com/posts/1"
    });

    const checked = postRepository.markChecked(inserted.post.id);
    const submitted = postRepository.markSubmitted(inserted.post.id);

    assert.equal(checked.isChecked, true);
    assert.equal(checked.isSubmitted, false);
    assert.equal(submitted.isChecked, true);
    assert.equal(submitted.isSubmitted, true);
    assert.equal(typeof submitted.updatedAt, "string");
  });

  it("marks posts as notified", () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const postRepository = createHousingPostRepository(database);
    const source = sourceRepository.create({ name: "source", url: "https://example.com" });
    const inserted = postRepository.insertIfNew({
      sourceId: source.id,
      title: "청약 공고",
      url: "https://example.com/posts/1"
    });

    const notified = postRepository.markNotified(inserted.post.id);

    assert.equal(typeof notified.notifiedAt, "string");
    assert.equal(typeof notified.updatedAt, "string");
  });

  it("finds recent housing posts newest first", () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const postRepository = createHousingPostRepository(database);
    const source = sourceRepository.create({ name: "source", url: "https://example.com" });

    const first = postRepository.insertIfNew({
      sourceId: source.id,
      title: "첫 번째",
      url: "https://example.com/posts/1"
    });
    const second = postRepository.insertIfNew({
      sourceId: source.id,
      title: "두 번째",
      url: "https://example.com/posts/2"
    });

    const posts = postRepository.findRecent(1);

    assert.deepEqual(
      posts.map((post) => post.id),
      [second.post.id]
    );
    assert.notEqual(first.post.id, second.post.id);
  });

  it("finds unnotified housing posts oldest first", () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const postRepository = createHousingPostRepository(database);
    const source = sourceRepository.create({ name: "source", url: "https://example.com" });
    const first = postRepository.insertIfNew({
      sourceId: source.id,
      title: "첫 번째",
      url: "https://example.com/posts/1"
    });
    const second = postRepository.insertIfNew({
      sourceId: source.id,
      title: "두 번째",
      url: "https://example.com/posts/2"
    });
    const third = postRepository.insertIfNew({
      sourceId: source.id,
      title: "세 번째",
      url: "https://example.com/posts/3"
    });

    postRepository.markNotified(second.post.id);

    assert.deepEqual(
      postRepository.findUnnotified(10).map((post) => post.id),
      [first.post.id, third.post.id]
    );
  });
});
