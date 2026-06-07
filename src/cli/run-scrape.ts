import { loadConfig } from "../config.js";
import { createDiscordWebhookAdapter } from "../notifications/discord-webhook-adapter.js";
import { createHousingPostNotifier } from "../notifications/housing-post-notifier.js";
import { createHousingScraperForSource } from "../scrapers/registry.js";
import { createScrapeService } from "../services/scrape-service.js";
import { openCliRepositories } from "./repositories.js";

const config = loadConfig();
const repositories = openCliRepositories(config);

try {
  const notifier = config.discordWebhookUrl
    ? createHousingPostNotifier({
        adapter: createDiscordWebhookAdapter({
          webhookUrl: config.discordWebhookUrl
        }),
        posts: repositories.housingPosts
      })
    : undefined;
  const service = createScrapeService(repositories, { notifier });
  const sources = repositories.sources.findEnabled();

  if (sources.length === 0) {
    console.log("No enabled scrape sources found. Run `npm run sources:seed:thepodium` first.");
  }

  for (const source of sources) {
    const scraper = createHousingScraperForSource(source);

    if (!scraper) {
      console.log(`Skipping unsupported source: id=${source.id} name="${source.name}"`);
      continue;
    }

    const result = await service.runHousingScraper(scraper);

    console.log(
      [
        `source=${source.id}`,
        `run=${result.run.id}`,
        `status=${result.status}`,
        `found=${result.foundCount}`,
        `new=${result.newCount}`,
        `duplicates=${result.duplicateCount}`,
        result.errorMessage ? `error="${result.errorMessage}"` : null,
        result.notificationErrorMessage
          ? `notificationError="${result.notificationErrorMessage}"`
          : null
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
} finally {
  repositories.database.close();
}
