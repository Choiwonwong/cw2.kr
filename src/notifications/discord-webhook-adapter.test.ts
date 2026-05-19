import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDiscordWebhookAdapter } from "./discord-webhook-adapter.js";
import type { NotificationMessage } from "./notification-adapter.js";

describe("discord webhook adapter", () => {
  it("posts notification messages to the Discord webhook URL", async () => {
    const requests: Array<{
      input: string | URL;
      init?: RequestInit;
    }> = [];
    const adapter = createDiscordWebhookAdapter({
      webhookUrl: "https://discord.com/api/webhooks/123/token",
      fetchImplementation: async (input, init) => {
        requests.push({ input, init });

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => ""
        };
      }
    });
    const message: NotificationMessage = {
      content: "테스트 알림"
    };

    await adapter.send(message);

    assert.equal(requests.length, 1);
    assert.equal(
      requests[0]?.input.toString(),
      "https://discord.com/api/webhooks/123/token?wait=true"
    );
    assert.equal(requests[0]?.init?.method, "POST");
    assert.deepEqual(
      JSON.parse(String(requests[0]?.init?.body)),
      {
        content: "테스트 알림",
        allowed_mentions: {
          parse: []
        }
      }
    );
  });

  it("throws when Discord returns an error response", async () => {
    const adapter = createDiscordWebhookAdapter({
      webhookUrl: "https://discord.com/api/webhooks/123/token",
      fetchImplementation: async () => ({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "invalid body"
      })
    });

    await assert.rejects(
      () =>
        adapter.send({
          content: "테스트 알림"
        }),
      /Discord webhook failed: 400 Bad Request invalid body/
    );
  });

  it("rejects empty messages before making an HTTP request", async () => {
    let requestCount = 0;
    const adapter = createDiscordWebhookAdapter({
      webhookUrl: "https://discord.com/api/webhooks/123/token",
      fetchImplementation: async () => {
        requestCount += 1;

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => ""
        };
      }
    });

    await assert.rejects(() => adapter.send({}), /must include content or embeds/);
    assert.equal(requestCount, 0);
  });
});
