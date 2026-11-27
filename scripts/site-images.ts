// node scripts/site-images.ts
// Draws fraktul.dev's social card (src/site/og.png, 1200x630) and touch icon (src/site/apple-touch-icon.png, 180x180)
// in headless Chromium. Both are committed; run this again only when the brand changes. Needs the network once, for
// the web fonts.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const mark = "M0 0H28V28H0Z M3 3H25V25H3Z M11.4 11.4H25V25H11.4Z M13.25 13.25H23.15V23.15H13.25Z M17.03 17.03H23.15V23.15H17.03Z";
const foil = "linear-gradient(115deg,#cbb9ff 0%,#a9d6ff 28%,#b6f0e2 52%,#ffeab4 74%,#ffc6e6 100%)";

const og = `<!doctype html><html><head><meta charset="utf-8" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Michroma&family=Syncopate:wght@700&family=Manrope:wght@500;600&family=JetBrains+Mono&display=block" />
<style>
  html, body { margin: 0; }
  body { width: 1200px; height: 630px; position: relative; overflow: hidden; font-family: Manrope, sans-serif; color: #0a0b0d;
    background: radial-gradient(120% 90% at 80% 10%, #ffffff 0%, #f2f3f5 55%, #dfe2e7 100%); }
  .foil { position: absolute; border-radius: 50%; background: ${foil}; filter: blur(70px); opacity: 0.55; }
  .f1 { width: 640px; height: 420px; right: -120px; top: -140px; }
  .f2 { width: 460px; height: 300px; left: 200px; bottom: -220px; opacity: 0.4; }
  .copy { position: absolute; left: 72px; top: 96px; width: 560px; }
  .eyebrow { font: 400 17px/1 Michroma, sans-serif; letter-spacing: 0.24em; text-transform: uppercase; color: #4a4f57; display: flex; align-items: center; gap: 16px; }
  .word { margin: 34px 0 26px; font: 700 84px/1 Syncopate, sans-serif; letter-spacing: -0.01em;
    background: linear-gradient(180deg, #ffffff 0%, #d9dde3 30%, #8a919b 49%, #3c4149 51%, #b9bfc7 72%, #f4f5f7 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; -webkit-text-stroke: 2px rgba(10, 11, 13, 0.6);
    filter: drop-shadow(0 3px 0 rgba(10, 11, 13, 0.18)) drop-shadow(0 14px 20px rgba(10, 11, 13, 0.2)); }
  .tag { font: 600 38px/1.25 Manrope, sans-serif; margin: 0 0 22px; }
  .sub { font: 500 23px/1.45 Manrope, sans-serif; color: #4a4f57; margin: 0; }
  svg.art { position: absolute; right: 30px; top: 86px; width: 520px; height: 440px; }
  .frame { fill: #ffffff; stroke: #0a0b0d; stroke-opacity: 0.55; }
  .edge { fill: none; stroke: url(#rim); stroke-width: 3; }
  .box { fill: #eef0f3; stroke: #9aa1aa; }
  .hot { fill: #efe6ff; stroke: #7b2ff0; stroke-width: 2.5; }
  .ln { stroke: #4a4f57; stroke-width: 1.4; fill: none; }
  .zoom { stroke: #4a4f57; stroke-dasharray: 3 5; stroke-width: 1.2; fill: none; opacity: 0.7; }
  .lbl { font: 600 11px Manrope, sans-serif; fill: #0a0b0d; }
  .code { font: 400 11px "JetBrains Mono", monospace; fill: #0a0b0d; }
  .url { position: absolute; left: 72px; bottom: 56px; font: 400 18px/1 Michroma, sans-serif; letter-spacing: 0.14em; color: #0a0b0d; }
</style></head><body>
  <span class="foil f1"></span><span class="foil f2"></span>
  <div class="copy">
    <div class="eyebrow"><svg width="40" height="40" viewBox="-1 -1 30 30"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d995cf"/><stop offset=".35" stop-color="#93a3ef"/><stop offset=".65" stop-color="#76cfc5"/><stop offset="1" stop-color="#e4cf86"/></linearGradient></defs><path fill-rule="evenodd" fill="url(#f)" stroke="#0a0b0d" stroke-opacity=".5" stroke-width=".7" d="${mark}"/></svg>Maps of software</div>
    <div class="word">fraktul</div>
    <p class="tag">A map of your system you can fall into.</p>
    <p class="sub">One model file. Diagrams down to the source. Checked against the code. Narrated tours.</p>
  </div>
  <svg class="art" viewBox="0 0 520 440">
    <defs><linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" /><stop offset="0.48" stop-color="#9aa1aa" /><stop offset="0.52" stop-color="#3c4149" /><stop offset="1" stop-color="#e6e8eb" /></linearGradient></defs>
    <rect class="frame" x="10" y="20" width="300" height="200" rx="16" /><rect class="edge" x="10" y="20" width="300" height="200" rx="16" />
    <rect class="box" x="34" y="56" width="92" height="40" rx="9" /><text class="lbl" x="80" y="81" text-anchor="middle">Teams</text>
    <rect class="box hot" x="172" y="56" width="112" height="40" rx="9" /><text class="lbl" x="228" y="81" text-anchor="middle">Answer core</text>
    <rect class="box" x="100" y="150" width="120" height="40" rx="9" /><text class="lbl" x="160" y="175" text-anchor="middle">Sources</text>
    <path class="ln" d="M126 76 H172 M228 96 C228 130 200 130 186 150 M80 96 C80 128 110 130 130 150" />
    <path class="zoom" d="M284 56 L300 150 M284 96 L470 310" />
    <rect class="frame" x="230" y="150" width="240" height="160" rx="14" /><rect class="edge" x="230" y="150" width="240" height="160" rx="14" />
    <rect class="box" x="250" y="178" width="80" height="34" rx="8" /><text class="lbl" x="290" y="199" text-anchor="middle">Sort</text>
    <rect class="box hot" x="370" y="178" width="80" height="34" rx="8" /><text class="lbl" x="410" y="199" text-anchor="middle">Read</text>
    <rect class="box" x="310" y="254" width="84" height="34" rx="8" /><text class="lbl" x="352" y="275" text-anchor="middle">Decide</text>
    <path class="ln" d="M330 195 H370 M410 212 C410 236 380 236 370 254" />
    <path class="zoom" d="M450 212 L470 330 M450 178 L512 330" />
    <rect class="frame" x="300" y="330" width="210" height="96" rx="12" /><rect class="edge" x="300" y="330" width="210" height="96" rx="12" />
    <text class="code" x="316" y="356">readFacts(table, q) {</text>
    <text class="code" x="330" y="378" style="fill: #1d4fd8">readChoices(…)</text>
    <text class="code" x="330" y="400">checkNumber(…)</text>
  </svg>
  <div class="url">fraktul.dev</div>
</body></html>`;

// The touch icon is the favicon's mark on the site's paper, with the margin iOS expects (it rounds the corners itself).
const favicon = readFileSync(join(ROOT, "src/site/favicon.svg"), "utf8");
const icon = `<!doctype html><html><body style="margin:0;width:180px;height:180px;display:grid;place-items:center;background:radial-gradient(120% 120% at 70% 10%,#ffffff,#e3e5e9)">
<div style="width:116px;height:116px">${favicon}</div></body></html>`;

const browser = await chromium.launch();
for (const [name, markup, width, height] of [["og.png", og, 1200, 630], ["apple-touch-icon.png", icon, 180, 180]] as const) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(markup, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(ROOT, "src/site", name), type: "png" });
  console.log(`site-images: src/site/${name} (${width}x${height})`);
  await page.close();
}
await browser.close();
