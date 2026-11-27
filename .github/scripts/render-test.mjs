#!/usr/bin/env node
// Opens pages in headless Chromium and waits until each one has actually drawn what it is for. A status check passes
// a page whose script fails; this does not. A map page must draw diagram boxes; any page must not throw.
//
// Usage: node .github/scripts/render-test.mjs <base-url> <path>[=map]...
//   /fraktuls/fraktul/=map   the page must draw a fraktul map (at least one diagram box)
//   /docs      the page must load without a script error
import { chromium } from "@playwright/test";

const [base, ...checks] = process.argv.slice(2);
if (!base || !checks.length) { console.error("usage: render-test.mjs <base-url> <path>[=map]..."); process.exit(2); }
const browser = await chromium.launch();
let failed = 0;
for (const check of checks) {
  const [path, kind] = check.split("=");
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const url = new URL(path, base).href;
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    if (kind === "map") await page.waitForSelector("svg g.node", { timeout: 60_000 });
    const boxes = kind === "map" ? await page.locator("svg g.node").count() : 0;
    if (errors.length) throw new Error(`script error: ${errors[0]}`);
    console.log(`${url}: ok${kind === "map" ? ` (${boxes} diagram boxes)` : ""}`);
  } catch (e) {
    failed++;
    console.log(`::error::${url}: ${e.message.split("\n")[0]}${errors.length ? ` (page error: ${errors[0]})` : ""}`);
  }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
