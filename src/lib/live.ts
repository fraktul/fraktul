// Live facts: numbers and lists read from the project at build time, so the map never repeats a fact by hand.
// fraktul reads the ADR folder itself (`adrs_dir`). Anything else comes from the project's own module (`live_module`
// in the model), whose default export returns named blocks; a node shows them with `live: [name, …]`.
//
//   // docs/arch/live.ts
//   import type { LiveContext, LiveBlock } from "<fraktul>/src/lib/live.ts";   // types only, optional
//   export default function (ctx: LiveContext): Record<string, LiveBlock> {
//     return { run: { title: "Latest run", bar: [{ label: "right", value: 631, tone: "good" }], rows: [["Right", 631]] } };
//   }

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot, type Model } from "./model.ts";

export type Adr = { num: string; title: string; status: string; file: string; text: string };
export type LiveBlock = {
  title: string;
  /** Label/value pairs, shown as a small table. */
  rows?: [string, string | number][];
  /** A stacked bar (for example right / safe / wrong). */
  bar?: { label: string; value: number; tone?: "good" | "warn" | "bad" | "neutral" }[];
  /** A list; `key` makes an item open something (node:id, file:repo:path, fn:repo:path#name, adr:0012). */
  list?: { label: string; note?: string; key?: string }[];
  /** Show the list folded under "All". */
  fold?: boolean;
  /** Groups with items (for example workflow stages and their steps). */
  groups?: { label: string; note?: string; items: string[] }[];
  text?: string;
  /** Where the facts came from (a path), shown small. */
  source?: string;
};
export type Live = { adrs: Adr[]; blocks: Record<string, LiveBlock> };
export type LiveContext = { project: string; modelDir: string; repoRoot: (repo: string) => string | null; adrs: Adr[] };

export function readAdrs(m: Model): Adr[] {
  if (!m.adrs_dir) return [];
  const dir = join(m.project, m.adrs_dir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d{4}-.*\.md$/.test(f)).sort().map((f) => {
    const text = readFileSync(join(dir, f), "utf8");
    const title = (text.match(/^#\s+(.+)$/m)?.[1] ?? f).replace(/^ADR \d+:\s*/, "");
    const status = text.match(/^-\s*Status:\s*(.+)$/m)?.[1]?.trim() ?? "";
    return { num: f.slice(0, 4), title, status, file: `${m.adrs_dir!.replace(/\/$/, "")}/${f}`, text };
  });
}

export async function readLive(m: Model): Promise<Live> {
  const adrs = readAdrs(m);
  const blocks: Record<string, LiveBlock> = {};
  if (adrs.length) {
    blocks.adrs = { title: `${adrs.length} decisions on record`, list: adrs.map((a) => ({ label: `${a.num} ${a.title}`, note: a.status.split(/[(;]/)[0].trim(), key: `adr:${a.num}` })) };
  }
  if (m.live_module) {
    const path = resolve(m.dir, m.live_module);
    const mod = await import(pathToFileURL(path).href);
    const ctx: LiveContext = { project: m.project, modelDir: m.dir, repoRoot: (r) => repoRoot(m, r), adrs };
    Object.assign(blocks, await mod.default(ctx));
  }
  return { adrs, blocks };
}
