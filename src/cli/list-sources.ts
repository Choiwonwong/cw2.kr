import { loadConfig } from "../config.js";
import { openCliRepositories } from "./repositories.js";

const repositories = openCliRepositories(loadConfig());

try {
  const sources = repositories.sources.findEnabled();

  if (sources.length === 0) {
    console.log("No enabled scrape sources found.");
  }

  for (const source of sources) {
    console.log(
      `id=${source.id} enabled=${source.enabled} name="${source.name}" url=${source.url}`
    );
  }
} finally {
  repositories.database.close();
}
