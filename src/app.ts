import Fastify, { type FastifyInstance } from "fastify";

import { loadConfig } from "./config.js";
import { registerHealthRoute } from "./routes/health.js";

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig();
  const app = Fastify({
    logger: true
  });

  await registerHealthRoute(app, config);

  return app;
}
