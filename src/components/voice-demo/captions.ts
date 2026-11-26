// Build-once: the example tour's narration captions (from `fraktul voice`), so the demo shows real, timed text.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { html } from "@bascik/bascik/html";
import { FRAKTUL } from "../../lib/model.ts";

export default function () {
  const path = join(FRAKTUL, "example", ".fraktul", "voice", "voice.json");
  if (!existsSync(path)) return html`<p class="none">Run <code>fraktul voice example/model.yaml</code> to hear this demo.</p>`;
  const tour = JSON.parse(readFileSync(path, "utf8")).tours["how-it-works"];
  const steps = Object.values(tour.steps) as { file: string; captions: { t: number; end: number; text: string }[] }[];
  // Each line: its start time (the track's own clock) and its text, like a playlist row.
  const ts = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  return html`${steps.map((s) => html`<ol class="lines" data-src="${s.file}">${s.captions.map((c) => html`<li data-t="${c.t}" data-end="${c.end}"><span class="ts">${ts(c.t)}</span><span class="tx">${c.text}</span></li>`)}</ol>`)}`;
}
