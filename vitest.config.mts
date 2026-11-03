/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    // The bundle smoke test needs the built bundle; `pnpm test:bundle` runs it after the build.
    exclude: ["**/node_modules/**", "**/bundle.smoke.test.ts"],
    environment: "node",
  },
});
