import type { ScrapeSource } from "../repositories/scrape-source-repository.js";
import type { HousingScraper } from "../services/scrape-service.js";
import {
  createThePodium830Scraper,
  THE_PODIUM_830_NOTICE_SOURCE_URL
} from "./the-podium-830-scraper.js";

export function createHousingScraperForSource(
  source: ScrapeSource
): HousingScraper | null {
  if (source.url === THE_PODIUM_830_NOTICE_SOURCE_URL) {
    const scraper = createThePodium830Scraper();

    return {
      sourceId: source.id,
      scrape: scraper.scrape
    };
  }

  return null;
}
