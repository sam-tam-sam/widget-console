import { defineConfig, devices } from "@playwright/test";
import { adminOrigin } from "./tests/platform-server";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 120_000,
  use: { ...devices["Desktop Chrome"], baseURL: adminOrigin, ignoreHTTPSErrors: true, trace: "retain-on-failure" },
});
