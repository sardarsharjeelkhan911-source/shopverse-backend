import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "file:./test.db",
    },
    globalSetup: "./test/globalSetup.ts",
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 180000,
  },
});