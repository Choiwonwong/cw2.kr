import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createThePodium830Scraper,
  mapThePodium830Notification
} from "./the-podium-830-scraper.js";

describe("the podium 830 scraper", () => {
  it("maps notice API records into housing post input", () => {
    const post = mapThePodium830Notification(
      {
        _id: "notice-1",
        subject: "첫 번째 공고",
        content: "<p>본문&nbsp;요약<br>다음 줄</p>",
        createdAt: "2026-05-19T00:00:00.000Z",
        upload: "/res/notification/notice-1/file.pdf",
        isNotice: false
      },
      0
    );

    assert.equal(post.sourceSeq, 1);
    assert.equal(post.externalId, "notice-1");
    assert.equal(post.title, "첫 번째 공고");
    assert.equal(post.description, "본문 요약 다음 줄");
    assert.equal(post.url, "https://thepodium830.com/center/notice/notice-1");
    assert.equal(post.isNotice, false);
    assert.equal(post.postedAt, "2026-05-19T00:00:00.000Z");
    assert.deepEqual(JSON.parse(post.attachmentsJson ?? "[]"), [
      {
        name: "file.pdf",
        url: "https://thepodium830.com/res/notification/notice-1/file.pdf"
      }
    ]);
  });

  it("fetches the first notice page through the public API", async () => {
    const calls: Array<{
      input: string | URL;
      init?: RequestInit;
    }> = [];
    const scraper = createThePodium830Scraper({
      fetchImplementation: async (input, init) => {
        calls.push({ input, init });

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            notifications: [
              {
                _id: "notice-1",
                subject: "첫 번째 공고",
                createdAt: "2026-05-19T00:00:00.000Z"
              }
            ]
          })
        };
      }
    });

    const posts = await scraper.scrape();

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.input.toString(),
      "https://thepodium830.com/api/v1/center/notifications?isNotice=false&searchKey=all&searchValue="
    );
    assert.deepEqual(calls[0]?.init?.headers, {
      skip: "0",
      limit: "10"
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.externalId, "notice-1");
  });

  it("throws when the public API fails", async () => {
    const scraper = createThePodium830Scraper({
      fetchImplementation: async () => ({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({})
      })
    });

    await assert.rejects(
      () => scraper.scrape(),
      /The Podium 830 notice API failed: 503 Service Unavailable/
    );
  });
});
