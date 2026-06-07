import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import { loadEnvFile } from "./config.js";

const touchedKeys = ["CW2_TEST_ENV_VALUE", "CW2_TEST_EXISTING_VALUE"];

afterEach(() => {
  for (const key of touchedKeys) {
    delete process.env[key];
  }
});

describe("config", () => {
  it("loads .env values without overwriting existing environment variables", () => {
    const directory = mkdtempSync(join(tmpdir(), "cw2-env-"));
    const envPath = join(directory, ".env");

    process.env.CW2_TEST_EXISTING_VALUE = "from-process";
    writeFileSync(
      envPath,
      [
        "# comment",
        "CW2_TEST_ENV_VALUE=from-file",
        "CW2_TEST_EXISTING_VALUE=from-file",
        ""
      ].join("\n")
    );

    try {
      loadEnvFile(envPath);

      assert.equal(process.env.CW2_TEST_ENV_VALUE, "from-file");
      assert.equal(process.env.CW2_TEST_EXISTING_VALUE, "from-process");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
