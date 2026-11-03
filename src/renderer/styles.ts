/**
 * Copyright (c) Freelens GPU Charts Authors. Licensed under MIT License.
 */

import css from "./gpu-charts.css?inline";

const STYLE_ELEMENT_ID = "freelens-gpu-charts-styles";

/**
 * Adds the stylesheet to the page once. The host loads the renderer bundle and nothing else of
 * the extension, so the CSS travels inside the bundle and is injected when a view first renders.
 */
export function ensureStyles(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ELEMENT_ID)) return;

  const style = document.createElement("style");

  style.id = STYLE_ELEMENT_ID;
  style.textContent = css;
  document.head.appendChild(style);
}
