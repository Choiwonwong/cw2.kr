import { existsSync, readFileSync } from "node:fs";

export type AppConfig = {
  port: number;
  host: string;
  version: string;
  databasePath: string;
  discordWebhookUrl: string | null;
};

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");

  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function loadEnvFile(envPath = ".env"): void {
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const entry = parseEnvLine(line);

    if (!entry) {
      continue;
    }

    const [key, value] = entry;

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

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
  loadEnvFile();

  return {
    port: readPort(process.env.PORT),
    host: process.env.HOST ?? "127.0.0.1",
    version: "1.0.0",
    databasePath: process.env.DATABASE_PATH ?? "./data/cw2.db",
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? null
  };
}
