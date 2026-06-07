import Fastify, { type FastifyInstance } from "fastify";

import { loadConfig } from "./config.js";
import type { AppConfig } from "./config.js";
import {
  openAppRepositories,
  type AppRepositories
} from "./repositories/app-repositories.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerHealthRoute } from "./routes/health.js";

export type BuildAppOptions = {
  config?: AppConfig;
  repositories?: AppRepositories;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const repositories = options.repositories ?? openAppRepositories(config);
  const shouldCloseDatabase = options.repositories === undefined;
  const app = Fastify({
    logger: true
  });

  app.get("/favicon.ico", async (_request, reply) => {
    return reply.code(204).send();
  });

  await registerHealthRoute(app, config);
  await registerDashboardRoutes(app, repositories);

  if (shouldCloseDatabase) {
    app.addHook("onClose", async () => {
      repositories.database.close();
    });
  }

  return app;
}
