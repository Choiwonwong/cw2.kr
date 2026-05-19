export type AppConfig = {
  port: number;
  host: string;
  version: string;
  databasePath: string;
  discordWebhookUrl: string | null;
};

function readPort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    port: readPort(process.env.PORT),
    host: process.env.HOST ?? "127.0.0.1",
    version: "1.0.0",
    databasePath: process.env.DATABASE_PATH ?? "./data/cw2.db",
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? null
  };
}
