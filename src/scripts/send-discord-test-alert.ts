import { loadConfig } from "../config.js";
import { createDiscordWebhookAdapter } from "../notifications/discord-webhook-adapter.js";

const config = loadConfig();

if (!config.discordWebhookUrl) {
  throw new Error("DISCORD_WEBHOOK_URL is required to send a test alert");
}

const adapter = createDiscordWebhookAdapter({
  webhookUrl: config.discordWebhookUrl
});

await adapter.send({
  content: "cw2.kr Discord 알림 테스트입니다.",
  username: "cw2.kr housing alert"
});

console.log("Sent Discord test alert");
