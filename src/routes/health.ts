import type { FastifyInstance } from "fastify";

import type { AppConfig } from "../config.js";

export async function registerHealthRoute(
  app: FastifyInstance,
  config: AppConfig
): Promise<void> {
  app.get("/health", async () => {
    return {
      ok: true,
      version: config.version
    };
  });
}
