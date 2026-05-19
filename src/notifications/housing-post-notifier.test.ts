import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { DatabaseConnection } from "../db/connection.js";
import { createHousingPostRepository } from "../repositories/housing-post-repository.js";
import { createScrapeSourceRepository } from "../repositories/scrape-source-repository.js";
import { createTestDatabase } from "../test/database.js";
import {
  buildHousingPostMessage,
  createHousingPostNotifier
} from "./housing-post-notifier.js";
import type { NotificationMessage } from "./notification-adapter.js";

let database: DatabaseConnection;

beforeEach(() => {
  database = createTestDatabase();
});

afterEach(() => {
  database.close();
});

describe("housing post notifier", () => {
  it("sends unnotified housing posts through the adapter and marks them notified", async () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const postRepository = createHousingPostRepository(database);
    const source = sourceRepository.create({
      name: "source",
      url: "https://example.com"
    });
    const inserted = postRepository.insertIfNew({
      sourceId: source.id,
      title: "청약 공고",
      description: "요약",
      url: "https://example.com/posts/1",
      isNotice: true
    });
    const sentMessages: NotificationMessage[] = [];
    const notifier = createHousingPostNotifier({
      posts: postRepository,
      adapter: {
        send: async (message) => {
          sentMessages.push(message);
        }
      }
    });

    const result = await notifier.notifyNewPosts([inserted.post]);

    assert.deepEqual(result, {
      attemptedCount: 1,
      sentCount: 1,
      skippedCount: 0
    });
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0]?.content, "새 청약/주거 공고가 발견됐습니다.");
    assert.equal(
      postRepository.findById(inserted.post.id)?.notifiedAt !== null,
      true
    );
  });

  it("skips posts that were already notified", async () => {
    const sourceRepository = createScrapeSourceRepository(database);
    const postRepository = createHousingPostRepository(database);
    const source = sourceRepository.create({
      name: "source",
      url: "https://example.com"
    });
    const inserted = postRepository.insertIfNew({
      sourceId: source.id,
      title: "청약 공고",
      url: "https://example.com/posts/1"
    });
    const notifiedPost = postRepository.markNotified(inserted.post.id);
    let sendCount = 0;
    const notifier = createHousingPostNotifier({
      posts: postRepository,
      adapter: {
        send: async () => {
          sendCount += 1;
        }
      }
    });

    const result = await notifier.notifyNewPosts([notifiedPost]);

    assert.deepEqual(result, {
      attemptedCount: 1,
      sentCount: 0,
      skippedCount: 1
    });
    assert.equal(sendCount, 0);
  });

  it("formats a housing post as a Discord-safe notification message", () => {
    const message = buildHousingPostMessage({
      id: 1,
      sourceId: 1,
      firstSeenRunId: null,
      sourceSeq: null,
      externalId: null,
      title: "청약 공고",
      description: "요약",
      url: "https://example.com/posts/1",
      isNotice: true,
      postedAt: "2026-05-19T00:00:00Z",
      attachmentsJson: null,
      notifiedAt: null,
      isChecked: false,
      isSubmitted: false,
      createdAt: "2026-05-19T00:00:00Z",
      updatedAt: null
    });

    assert.equal(message.embeds?.[0]?.title, "청약 공고");
    assert.equal(message.embeds?.[0]?.url, "https://example.com/posts/1");
    assert.deepEqual(message.embeds?.[0]?.fields, [
      {
        name: "게시일",
        value: "2026-05-19T00:00:00Z",
        inline: true
      },
      {
        name: "분류",
        value: "공지",
        inline: true
      }
    ]);
  });
});
