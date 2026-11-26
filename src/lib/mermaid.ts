// Reads a Mermaid flowchart once, at build time, into a template the browser can re-assemble with different ids.
//
// The explorer's Mermaid conventions (plain Mermaid otherwise):
//   - A box whose id is a model node id is a building block: it can be opened (its own diagram) or expanded in place
//     (its diagram inlined as a subgraph).
//   - `block/inner` in an edge points at a box inside another block: the inner box when that block is expanded here,
//     the block itself when it is collapsed.
//   - `%% @link <box> <anchor>` makes a plain box open a file, a function (`path#name`) or an ADR (`adr:0012`).
//   - `%% @expand <box>` shows that block expanded when the diagram opens.
// `click` and `linkStyle` lines are dropped: the explorer wires clicks itself, and index-based link styles break when
// diagrams are combined.

export type Token = { id: string; inner?: string; shape: string; cls: string };
export type Line = { t: string; tok: Token[]; bare?: string; kind?: "class" | "style" };
export type Parsed = {
  header: string;
  direction: string;
  lines: Line[];
  ids: string[];
  links: Record<string, string>;
  expand: string[];
  refs: { block: string; inner: string }[];
};

export const MARK = (i: number) => `\u0001${i}\u0002`;
const KEYWORDS = new Set(["end", "subgraph", "direction", "classDef", "class", "style", "linkStyle", "click", "flowchart", "graph", "TD", "TB", "LR", "RL", "BT"]);
const OPEN: Record<string, string> = { "[": "]", "(": ")", "{": "}" };

function skipQuoted(s: string, i: number): number {
  const q = s[i];
  let j = i + 1;
  while (j < s.length && s[j] !== q) j++;
  return Math.min(j + 1, s.length);
}

/** End (exclusive) of a node shape that starts at s[i]: [..], (..), {..}, [(..)], ((..)), >..], with quotes skipped. */
function skipShape(s: string, i: number): number {
  if (s[i] === ">") {
    let j = i + 1;
    while (j < s.length && s[j] !== "]") j = s[j] === '"' ? skipQuoted(s, j) : j + 1;
    return Math.min(j + 1, s.length);
  }
  const stack: string[] = [];
  let j = i;
  while (j < s.length) {
    const c = s[j];
    if (c === '"') { j = skipQuoted(s, j); continue; }
    if (OPEN[c]) stack.push(OPEN[c]);
    else if (c === stack[stack.length - 1]) { stack.pop(); if (!stack.length) return j + 1; }
    j++;
  }
  return s.length;
}

const ARROW_END = /(-->|---|-\.->|\.->|==>|===|--x|--o)/;

/** One statement line → template + tokens. */
export function parseStatement(src: string): Line {
  const tok: Token[] = [];
  let out = "";
  let i = 0;
  const s = src;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c) || c === "&" || c === ";") { out += c; i++; continue; }
    if (c === '"') { const j = skipQuoted(s, i); out += s.slice(i, j); i = j; continue; }
    if (c === "|") { let j = s.indexOf("|", i + 1); j = j < 0 ? s.length : j + 1; out += s.slice(i, j); i = j; continue; }
    if (/[-=.<~]/.test(c)) {
      let j = i;
      while (j < s.length && /[-=.<>~ox]/.test(s[j]) && !(/[ox]/.test(s[j]) && /\w/.test(s[j + 1] ?? ""))) j++;
      const run = s.slice(i, j);
      // A labelled edge written as `A -- text --> B`: copy the label with its closing arrow.
      if (/^(--|-\.|==)$/.test(run) && s[j] === " ") {
        const rest = s.slice(j);
        const m = rest.match(ARROW_END);
        if (m && m.index !== undefined && m.index > 0 && !/^\s*[-=.]/.test(rest)) {
          const k = j + m.index + m[0].length;
          out += s.slice(i, k);
          i = k;
          continue;
        }
      }
      out += run || c;
      i = j > i ? j : i + 1;
      continue;
    }
    const m = s.slice(i).match(/^([A-Za-z0-9_]+)(?:\/([A-Za-z0-9_]+))?/);
    if (m) {
      let j = i + m[0].length;
      let shape = "", cls = "";
      if (j < s.length && /[[({>]/.test(s[j])) { const k = skipShape(s, j); shape = s.slice(j, k); j = k; }
      const cm = s.slice(j).match(/^:::[A-Za-z0-9_-]+/);
      if (cm) { cls = cm[0]; j += cm[0].length; }
      if (KEYWORDS.has(m[1]) && !m[2] && !shape) { out += m[0] + cls; i = j; continue; }
      tok.push({ id: m[1], ...(m[2] ? { inner: m[2] } : {}), shape, cls });
      out += MARK(tok.length - 1);
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  const line: Line = { t: out, tok };
  if (tok.length === 1 && out.trim() === MARK(0)) line.bare = tok[0].id;
  return line;
}

export function parseFlowchart(text: string): Parsed {
  const raw = text.replace(/\r/g, "").split("\n");
  let header = "flowchart TD";
  const lines: Line[] = [];
  const links: Record<string, string> = {};
  const expand: string[] = [];
  let seenHeader = false;
  for (const r of raw) {
    const s = r.trim();
    if (!s) continue;
    const d = s.match(/^%%\s*@(link|expand)\s+(\S+)(?:\s+(\S+))?/);
    if (d) {
      if (d[1] === "link" && d[3]) links[d[2]] = d[3];
      if (d[1] === "expand") expand.push(d[2]);
      continue;
    }
    if (s.startsWith("%%")) continue;
    if (!seenHeader && /^(flowchart|graph)\b/.test(s)) { header = s; seenHeader = true; continue; }
    if (/^(click|linkStyle)\b/.test(s)) continue;
    if (/^classDef\b/.test(s) || /^direction\b/.test(s) || s === "end") { lines.push({ t: s, tok: [] }); continue; }
    let m = s.match(/^class\s+([\w,/ ]+?)\s+([\w-]+)\s*;?$/);
    if (m) {
      const ids = m[1].split(",").map((x) => x.trim()).filter(Boolean);
      lines.push({ t: `class ${ids.map((_, i) => MARK(i)).join(",")} ${m[2]}`, tok: ids.map((id) => ({ id, shape: "", cls: "" })), kind: "class" });
      continue;
    }
    m = s.match(/^style\s+(\w+)\s+(.*)$/);
    if (m) { lines.push({ t: `style ${MARK(0)} ${m[2]}`, tok: [{ id: m[1], shape: "", cls: "" }], kind: "style" }); continue; }
    m = s.match(/^subgraph\s+(.*)$/);
    if (m) {
      const st = parseStatement(m[1]);
      lines.push({ t: `subgraph ${st.t}`, tok: st.tok });
      continue;
    }
    lines.push(parseStatement(s));
  }
  const ids: string[] = [];
  const refs: { block: string; inner: string }[] = [];
  for (const l of lines) for (const t of l.tok) {
    if (!ids.includes(t.id)) ids.push(t.id);
    if (t.inner) refs.push({ block: t.id, inner: t.inner });
  }
  const direction = header.split(/\s+/)[1] ?? "TD";
  return { header, direction, lines, ids, links, expand, refs };
}

/** Plain text back from a parsed diagram (ids unchanged, `a/b` written as `a`): used by tests and the no-JS fallback. */
export function plain(p: Parsed): string {
  return [p.header, ...p.lines.map((l) => l.t.replace(/\u0001(\d+)\u0002/g, (_, i) => { const k = l.tok[Number(i)]; return k.id + k.shape + k.cls; }))].join("\n");
}
