import { loadConfig } from "../config.js";
import { openCliRepositories } from "./repositories.js";
import { THE_PODIUM_830_NOTICE_SOURCE_URL } from "../scrapers/the-podium-830-scraper.js";

const repositories = openCliRepositories(loadConfig());

try {
  const existing = repositories.sources.findByUrl(THE_PODIUM_830_NOTICE_SOURCE_URL);

  if (existing) {
    console.log(
      `Source already exists: id=${existing.id} name="${existing.name}" enabled=${existing.enabled}`
    );
  } else {
    const source = repositories.sources.create({
      name: "더포디엄830 공지사항",
      url: THE_PODIUM_830_NOTICE_SOURCE_URL
    });

    console.log(`Created source: id=${source.id} name="${source.name}"`);
  }
} finally {
  repositories.database.close();
}
