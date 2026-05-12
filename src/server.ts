import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await buildApp();

try {
  const address = await app.listen({
    host: config.host,
    port: config.port
  });

  app.log.info(`cw2.kr ${config.version} listening at ${address}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
