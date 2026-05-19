import type {
  NotificationAdapter,
  NotificationMessage
} from "./notification-adapter.js";

type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status" | "statusText" | "text">>;

export type DiscordWebhookAdapterOptions = {
  webhookUrl: string;
  fetchImplementation?: FetchLike;
  waitForConfirmation?: boolean;
};

function hasMessageBody(message: NotificationMessage): boolean {
  return Boolean(
    message.content?.trim() ||
      (message.embeds !== undefined && message.embeds.length > 0)
  );
}

function toExecuteWebhookUrl(webhookUrl: string, waitForConfirmation: boolean): URL {
  const url = new URL(webhookUrl);

  if (!url.searchParams.has("wait")) {
    url.searchParams.set("wait", String(waitForConfirmation));
  }

  return url;
}

export function createDiscordWebhookAdapter({
  webhookUrl,
  fetchImplementation = fetch,
  waitForConfirmation = true
}: DiscordWebhookAdapterOptions): NotificationAdapter {
  const executeWebhookUrl = toExecuteWebhookUrl(webhookUrl, waitForConfirmation);

  return {
    async send(message) {
      if (!hasMessageBody(message)) {
        throw new Error("Discord webhook message must include content or embeds");
      }

      const response = await fetchImplementation(executeWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...message,
          allowed_mentions: {
            parse: []
          }
        })
      });

      if (!response.ok) {
        const responseBody = await response.text();
        throw new Error(
          `Discord webhook failed: ${response.status} ${response.statusText} ${responseBody}`.trim()
        );
      }
    }
  };
}
