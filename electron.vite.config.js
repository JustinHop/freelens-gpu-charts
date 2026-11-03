/**
 * Copyright (c) 2026 Tal Naeh (original: freelens-gpu-extension, MIT)
 * Copyright (c) 2026 Freelens GPU Charts Authors
 * Licensed under MIT License. See LICENSE in root directory for more information.
 *
 * Adapted from electron.vite.config.js of https://github.com/freelensapp/freelens-gpu-extension.
 */

import { builtinModules } from "node:module";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import { globalExternals } from "./build/global-externals.js";

// Provided by the Node/Electron runtime inside Freelens; never bundle them.
const runtimeExternals = ["electron", /^electron\//, ...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

// The extension has no main entry: Freelens loads `renderer` only. The renderer
// bundle is built with the preload settings (CommonJS, Node-capable), which is how
// Freelens 1.x loads extension renderers.
export default defineConfig({
  preload: {
    build: {
      lib: {
        entry: resolve(__dirname, "src/renderer/index.tsx"),
        formats: ["cjs"],
      },
      outDir: "out/renderer",
      rolldownOptions: {
        external: runtimeExternals,
        output: {
          exports: "named",
          // One self-contained file: the smoke test and the host load a single module.
          preserveModules: false,
          codeSplitting: false,
        },
      },
      sourcemap: true,
    },
    plugins: [
      react(),
      globalExternals({
        // Provided by the Freelens host as globals; must never be bundled a second time.
        "@freelensapp/extensions": "global.LensExtensions",
        mobx: "global.Mobx",
        "mobx-react": "global.MobxReact",
        react: "global.React",
        "react-dom": "global.ReactDOM",
        "react-router": "global.ReactRouter",
        "react-router-dom": "global.ReactRouterDom",
        "react/jsx-runtime": "global.ReactJsxRuntime",
      }),
    ],
  },
});
