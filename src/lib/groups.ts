// Big files, drawn the way a careful person would draw them by hand. A file with dozens of functions and every call
// as a line is a hairball nobody can read. Someone drawing it would:
//   1. gather the functions into a few named groups (the file's own section headings, when it has them);
//   2. draw one line between two groups, not one per call;
//   3. leave out the lines to small helpers everything uses (they say nothing about the flow).
// groupFile() does the first and names the helpers; build.ts draws the overview and one diagram per group.

export type GroupFn = { key: string; name: string; line: number; exported: boolean; calls: string[]; calledBy: string[] };
export type Section = { title: string; line: number };
export type Group = { slug: string; title: string; fns: string[]; note: string };
export type Grouping = { groups: Group[]; helpers: Set<string> };

/** Files with more functions than this are drawn as groups. */
export const GROUP_OVER = 20;
const MAX_GROUPS = 12;
const CHUNK = 18;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "group";

/**
 * Section headings in source: a comment line that is a title between rules ("// ───── drawing ─────", "# ==== IO ===="),
 * a `// MARK: Title` line, or a `#region Title` line. Only headings at the left margin count.
 */
export function sectionsOf(src: string[]): Section[] {
  const out: Section[] = [];
  src.forEach((raw, i) => {
    const m = raw.match(/^(?:\/\/|#|--|\/\*+)\s*(.*?)\s*(?:\*\/)?\s*$/);
    if (!m) return;
    const body = m[1];
    const ruled = body.match(/^[─━═=\-*~_#]{3,}\s*(.*?)\s*[─━═=\-*~_#]*$/);
    const marked = body.match(/^(?:MARK:\s*-?\s*|#?region\s+)(.+)$/i);
    // "Peek: hover a box to see what is inside" is drawn as "Peek": a box holds a name, not a sentence.
    const title = (ruled?.[1] ?? marked?.[1] ?? "").replace(/\s*\(.*\)\s*$/, "").replace(/^(.{2,}?):\s.*$/, "$1").replace(/[:.]$/, "").trim();
    if (title && /[A-Za-z]/.test(title) && title.length <= 80) out.push({ title: title[0].toUpperCase() + title.slice(1), line: i + 1 });
  });
  return out;
}

/** Functions so widely called inside the file that lines to them only add noise. */
function helpersOf(fns: GroupFn[]): Set<string> {
  const own = new Set(fns.map((f) => f.key));
  const need = Math.max(5, Math.ceil(fns.length * 0.08));
  return new Set(fns.filter((f) => f.calledBy.filter((c) => own.has(c)).length >= need).map((f) => f.key));
}

/** Splits a long run of functions into pieces of a readable size, in file order. */
function chunk(title: string, keys: string[], note: string): { title: string; fns: string[]; note: string }[] {
  if (keys.length <= CHUNK * 1.5) return [{ title, fns: keys, note }];
  const n = Math.ceil(keys.length / CHUNK), size = Math.ceil(keys.length / n);
  return Array.from({ length: n }, (_, i) => ({ title: `${title} ${i + 1}`, fns: keys.slice(i * size, (i + 1) * size), note }));
}

export function groupFile(fns: GroupFn[], sections: Section[]): Grouping {
  const helpers = helpersOf(fns);
  const ordered = [...fns].sort((a, b) => a.line - b.line);
  let raw: { title: string; fns: string[]; note: string }[] = [];

  // 1. The file's own headings.
  const bySection = new Map<number, string[]>();
  for (const f of ordered) {
    let at = -1;
    sections.forEach((s, i) => { if (s.line < f.line) at = i; });
    bySection.set(at, [...(bySection.get(at) ?? []), f.key]);
  }
  const filled = [...bySection.entries()].filter(([i]) => i >= 0);
  if (filled.length >= 3 && Math.max(...filled.map(([, k]) => k.length)) <= fns.length * 0.6) {
    for (const [i, keys] of [...bySection.entries()].sort((a, b) => a[0] - b[0])) raw.push(...chunk(i < 0 ? "Top of the file" : sections[i].title, keys, i < 0 ? "Before the first heading in the file." : "A section of the file, under its own heading."));
  } else {
    // 2. No headings: follow the calls. A function nothing in the file calls is an entry point; what only it
    // reaches is its own. What several entry points reach is shared.
    const byKey = new Map(fns.map((f) => [f.key, f]));
    const flow = fns.filter((f) => !helpers.has(f.key));
    const roots = flow.filter((f) => !f.calledBy.some((c) => byKey.has(c) && !helpers.has(c) && c !== f.key));
    const owners = new Map<string, Set<string>>();
    for (const r of roots) {
      const seen = new Set<string>([r.key]);
      for (const q = [r.key]; q.length; ) for (const c of byKey.get(q.shift()!)!.calls) if (byKey.has(c) && !helpers.has(c) && !seen.has(c)) { seen.add(c); q.push(c); }
      for (const k of seen) owners.set(k, (owners.get(k) ?? new Set()).add(r.key));
    }
    const owned = new Map<string, string[]>();
    const shared: string[] = [], alone: string[] = [];
    for (const f of ordered) {
      if (helpers.has(f.key)) continue;
      const o = owners.get(f.key);
      if (!o || o.size !== 1) shared.push(f.key);
      else owned.set([...o][0], [...(owned.get([...o][0]) ?? []), f.key]);
    }
    for (const [root, keys] of owned) {
      if (keys.length === 1) alone.push(root);
      else raw.push({ title: `${byKey.get(root)!.name}() and what it calls`, fns: keys, note: `Everything only ${byKey.get(root)!.name}() reaches.` });
    }
    raw.sort((a, b) => b.fns.length - a.fns.length);
    // Too many small flows to tell apart: the smallest ones go into one group.
    if (raw.length > MAX_GROUPS - 3) { const rest = raw.splice(MAX_GROUPS - 3); alone.push(...rest.flatMap((g) => g.fns)); }
    const inOrder = (keys: string[]) => keys.sort((a, b) => byKey.get(a)!.line - byKey.get(b)!.line);
    if (shared.length) raw.push(...chunk("Shared by several flows", inOrder(shared), "Functions more than one entry point reaches."));
    if (alone.length) raw.push(...chunk("On their own", inOrder(alone), "Functions that call nothing else here, or small flows of two or three."));
    const h = ordered.filter((f) => helpers.has(f.key)).map((f) => f.key);
    if (h.length) raw.push(...chunk("Helpers used everywhere", h, "Small functions called from all over the file. Lines to them are left out."));
  }

  const used = new Set<string>();
  const groups = raw.filter((g) => g.fns.length).map((g) => {
    let slug = slugify(g.title);
    for (let n = 2; used.has(slug); n++) slug = `${slugify(g.title)}-${n}`;
    used.add(slug);
    return { slug, title: g.title, fns: g.fns, note: g.note };
  });
  return { groups, helpers };
}
