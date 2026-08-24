import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web"),
      "server-only": path.resolve(__dirname, "apps/web/test-utils/server-only-stub.ts"),
    },
  },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "apps/web/lib/data/**/*.test.ts",
      "apps/web/lib/auth/**/*.test.ts",
      "apps/web/lib/web3/**/*.test.ts",
      "apps/web/lib/services/**/*.test.ts",
      "apps/web/lib/world/**/*.test.ts",
    ],
    environment: "node",
    // threads pool avoids child-process forks (sandbox-friendly, faster for pure TS)
    pool: "threads",
    // DB integration / E2E suites share the real database (single demo
    // trainer) — files must run sequentially to avoid cross-file cleanup races.
    fileParallelism: false,
    server: {
      deps: {
        inline: [/@chainmon\//],
      },
    },
  },
});
