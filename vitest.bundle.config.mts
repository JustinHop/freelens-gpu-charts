/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/bundle.smoke.test.ts"],
    environment: "jsdom",
  },
});
