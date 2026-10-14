import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    globalSetup: ["tests/helpers/mongo-global-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
