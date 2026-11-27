// node scripts/site-shots.ts <base-url>
// Takes fraktul.dev's screenshots of the live map (src/site/img/*.webp, two widths each) in headless Chromium. They
// are committed; run this against a local build of the site when the map's look changes:
//   npm run site:build && npx wrangler dev   (or any static server on site-dist), then
//   node scripts/site-shots.ts http://localhost:8787
// Each shot is a deep link, so the pages can also say "open this view live". Needs cwebp on the path.
import { chromium, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { SHOTS } from "../src/lib/shots.ts";

const base = process.argv[2];
if (!base) { console.error("usage: node scripts/site-shots.ts <base-url of a running fraktul.dev build>"); process.exit(2); }
const OUT = join(import.meta.dirname, "..", "src/site/img");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"] });
for (const shot of SHOTS) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: "dark" });
  const page: Page = await context.newPage();
  await page.goto(`${base}${shot.map ?? "/fraktuls/fraktul/"}${shot.link}`, { waitUntil: "load" });
  await page.waitForSelector("svg g.node", { state: "attached", timeout: 30_000 });
  if (shot.link.includes("view=3d")) { await page.waitForSelector("canvas", { timeout: 30_000 }); await page.waitForTimeout(6500); }
  else await page.waitForTimeout(1200);
  if (shot.hover) { await page.locator("svg g.node", { hasText: shot.hover }).first().hover(); await page.waitForTimeout(1500); }
  const png = join(OUT, `${shot.id}.png`);
  await page.screenshot({ path: png });
  for (const w of [1280, 720]) execFileSync("cwebp", ["-quiet", "-q", "78", "-resize", String(w), "0", png, "-o", join(OUT, `${shot.id}-${w}.webp`)]);
  rmSync(png);
  console.log(`site-shots: ${shot.id} (${shot.link})`);
  await context.close();
}
await browser.close();
