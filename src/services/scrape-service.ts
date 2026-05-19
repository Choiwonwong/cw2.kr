import type {
  HousingPost,
  HousingPostRepository,
  InsertHousingPostInput
} from "../repositories/housing-post-repository.js";
import type {
  ScrapeRun,
  ScrapeRunRepository
} from "../repositories/scrape-run-repository.js";
import type { ScrapeSourceRepository } from "../repositories/scrape-source-repository.js";
import type { HousingPostNotifier } from "../notifications/housing-post-notifier.js";

export type ScrapedHousingPost = Omit<
  InsertHousingPostInput,
  "sourceId" | "firstSeenRunId"
>;

export type HousingScraper = {
  sourceId: number;
  scrape(): Promise<ScrapedHousingPost[]>;
};

export type SourceHealth = "unknown" | "healthy" | "degraded" | "unhealthy";

export type ScrapeServiceRepositories = {
  sources: ScrapeSourceRepository;
  runs: ScrapeRunRepository;
  housingPosts: HousingPostRepository;
};

export type ScrapeServiceOptions = {
  notifier?: HousingPostNotifier;
};

export type ScrapeServiceRunResult = {
  run: ScrapeRun;
  status: "success" | "failed";
  foundCount: number;
  newCount: number;
  duplicateCount: number;
  newPosts: HousingPost[];
  errorMessage: string | null;
};

export type ScrapeService = {
  runHousingScraper(scraper: HousingScraper): Promise<ScrapeServiceRunResult>;
  getSourceHealth(sourceId: number): SourceHealth;
};

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function calculateSourceHealth(recentRuns: ScrapeRun[]): SourceHealth {
  if (recentRuns.length === 0) {
    return "unknown";
  }

  const latestRun = recentRuns[0];

  if (latestRun?.status === "success") {
    return "healthy";
  }

  const latestThreeRuns = recentRuns.slice(0, 3);

  if (
    latestThreeRuns.length === 3 &&
    latestThreeRuns.every((run) => run.status === "failed")
  ) {
    return "unhealthy";
  }

  return "degraded";
}

export function createScrapeService(
  repositories: ScrapeServiceRepositories,
  options: ScrapeServiceOptions = {}
): ScrapeService {
  return {
    async runHousingScraper(scraper) {
      const run = repositories.runs.create(scraper.sourceId);

      try {
        const scrapedPosts = await scraper.scrape();
        const newPosts: HousingPost[] = [];
        let duplicateCount = 0;

        for (const scrapedPost of scrapedPosts) {
          const result = repositories.housingPosts.insertIfNew({
            ...scrapedPost,
            sourceId: scraper.sourceId,
            firstSeenRunId: run.id
          });

          if (result.inserted) {
            newPosts.push(result.post);
          } else {
            duplicateCount += 1;
          }
        }

        if (options.notifier) {
          await options.notifier.notifyNewPosts(newPosts);
        }

        const finishedRun = repositories.runs.markSuccess(run.id);

        return {
          run: finishedRun,
          status: "success",
          foundCount: scrapedPosts.length,
          newCount: newPosts.length,
          duplicateCount,
          newPosts,
          errorMessage: null
        };
      } catch (error) {
        const errorMessage = errorToMessage(error);
        const failedRun = repositories.runs.markFailed(run.id, errorMessage);

        return {
          run: failedRun,
          status: "failed",
          foundCount: 0,
          newCount: 0,
          duplicateCount: 0,
          newPosts: [],
          errorMessage
        };
      }
    },

    getSourceHealth(sourceId) {
      const recentRuns = repositories.runs.findRecentBySource(sourceId, 3);

      return calculateSourceHealth(recentRuns);
    }
  };
}
