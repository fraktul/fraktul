// Functions, imports and calls read out of TypeScript and Python source with line rules (no compiler). The repos are
// formatted consistently (a block closes on a line at its opening indent), which is what these rules rely on.

import { existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

import { sectionsOf, type Section } from "./groups.ts";
export type Fn = { name: string; line: number; end: number; indent: number; exported: boolean; doc: string; params: string };
export type ImportRef = { local: string; remote: string; from: string; ns?: boolean };
export type CodeFile = { lang: "ts" | "py" | "other"; lines: number; doc: string; functions: Fn[]; imports: ImportRef[]; importFiles: string[]; sections: Section[] };

const indentOf = (s: string) => s.match(/^\s*/)![0].length;
export const langOf = (path: string): CodeFile["lang"] => (/\.(ts|mts|js|mjs)$/.test(path) ? "ts" : /\.py$/.test(path) ? "py" : "other");

const TS_FN = /^(\s*)(export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)\s*(?:<.*>)?\s*\(([^)]*)/;
const TS_ARROW = /^(\s*)(export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*(?:async\s+)?(?:function\b[^(]*)?\(([^)]*)/;
const PY_DEF = /^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)/;

function docAbove(src: string[], i: number, lang: CodeFile["lang"]): string {
  const out: string[] = [];
  for (let j = i - 1; j >= 0; j--) {
    const s = src[j].trim();
    if (lang === "ts" && (s.startsWith("//") || s.startsWith("*") || s.startsWith("/**") || s.endsWith("*/"))) out.unshift(s.replace(/^(\/\/+|\/\*\*?|\*\/?)\s?/, "").replace(/\*\/$/, ""));
    else if (lang === "py" && s.startsWith("#")) out.unshift(s.replace(/^#+\s?/, ""));
    else if (lang === "py" && s.startsWith("@")) continue;
    else break;
  }
  return out.join(" ").trim();
}

function pyDocstring(src: string[], start: number, end: number): string {
  for (let j = start + 1; j <= Math.min(end, start + 6); j++) {
    const s = src[j]?.trim() ?? "";
    const m = s.match(/^[rbuf]*("""|''')(.*)/);
    if (m) {
      let body = m[2];
      if (body.includes(m[1])) return body.slice(0, body.indexOf(m[1])).trim();
      for (let k = j + 1; k <= end && k < j + 8; k++) {
        const t = src[k].trim();
        if (t.includes(m[1])) { body += " " + t.slice(0, t.indexOf(m[1])); break; }
        body += " " + t;
      }
      return body.trim();
    }
    if (s && !s.endsWith(":") && !s.startsWith(")")) break;
  }
  return "";
}

/** End line (0-based, inclusive) of a block opened at line i. */
function blockEnd(src: string[], i: number): number {
  const ind = indentOf(src[i]);
  const first = src[i];
  // One-line definitions: braces balance on the line and it ends a statement.
  const opens = (first.match(/[{(]/g) ?? []).length, closes = (first.match(/[})]/g) ?? []).length;
  if (opens <= closes && /[;)}]\s*(\/\/.*)?$/.test(first.trim()) && !/=>\s*$/.test(first.trim())) return i;
  for (let j = i + 1; j < src.length; j++) {
    const s = src[j];
    if (!s.trim()) continue;
    const k = indentOf(s);
    if (k < ind) return j - 1;
    if (k === ind) return /^\s*[})\]]/.test(s) ? j : j - 1;
  }
  return src.length - 1;
}

function pyBlockEnd(src: string[], i: number): number {
  const ind = indentOf(src[i]);
  let j = i;
  while (j < src.length && !/:\s*(#.*)?$/.test(src[j])) j++;
  let last = j;
  for (let k = j + 1; k < src.length; k++) {
    const s = src[k];
    if (!s.trim()) continue;
    if (indentOf(s) <= ind) break;
    last = k;
  }
  return last;
}

function fileDoc(src: string[], lang: CodeFile["lang"]): string {
  const out: string[] = [];
  let i = 0;
  if (src[0]?.startsWith("#!")) i++;
  if (lang === "py") {
    while (i < src.length && (src[i].startsWith("#") || !src[i].trim())) { if (src[i].startsWith("#")) out.push(src[i].replace(/^#+\s?/, "")); i++; }
    const m = src[i]?.match(/^[rbuf]*("""|''')(.*)/);
    if (m) {
      let body = m[2];
      if (!body.includes(m[1])) for (let k = i + 1; k < src.length && k < i + 12; k++) { if (src[k].includes(m[1])) { body += " " + src[k].slice(0, src[k].indexOf(m[1])); break; } body += " " + src[k].trim(); }
      else body = body.slice(0, body.indexOf(m[1]));
      out.push(body);
    }
  } else {
    for (; i < src.length; i++) {
      const s = src[i].trim();
      if (s.startsWith("//")) out.push(s.replace(/^\/\/+\s?/, ""));
      else if (s.startsWith("/*") || s.startsWith("*")) out.push(s.replace(/^\/\*+|\*\/$|^\*\s?/g, ""));
      else if (!s && !out.length) continue;
      else break;
    }
  }
  return out.join(" ").replace(/\s+/g, " ").trim().slice(0, 600);
}

function tsImports(text: string, from: string): ImportRef[] {
  const out: ImportRef[] = [];
  for (const m of text.matchAll(/import\s+(?:type\s+)?([\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    for (const part of m[2].split(",")) {
      const p = part.trim();
      if (!p || p.startsWith("type ")) continue;
      const [remote, local] = p.split(/\s+as\s+/).map((x) => x.trim());
      out.push({ local: local ?? remote, remote, from: m[3] });
    }
  }
  for (const m of text.matchAll(/import\s+\*\s+as\s+([\w$]+)\s+from\s*["']([^"']+)["']/g)) out.push({ local: m[1], remote: "*", from: m[2], ns: true });
  return out.filter((r) => r.from.startsWith(".") || r.from.startsWith("/"));
}

function pyImports(text: string): ImportRef[] {
  const out: ImportRef[] = [];
  for (const m of text.matchAll(/^from\s+(\.?[\w.]+)\s+import\s+\(?([^)\n]+)\)?/gm)) {
    for (const part of m[2].split(",")) {
      const [remote, local] = part.trim().split(/\s+as\s+/);
      if (remote && remote !== "*") out.push({ local: local ?? remote, remote, from: m[1] });
    }
  }
  for (const m of text.matchAll(/^import\s+([\w.]+)(?:\s+as\s+(\w+))?\s*$/gm)) out.push({ local: m[2] ?? m[1], remote: "*", from: m[1], ns: true });
  return out;
}

/** Repo-relative path an import points at, if that file exists. */
export function resolveImport(root: string, file: string, spec: string, lang: CodeFile["lang"]): string | null {
  if (lang === "ts") {
    const p = normalize(join(dirname(file), spec));
    for (const c of [p, `${p}.ts`, join(p, "index.ts")]) if (!c.startsWith("..") && existsSync(join(root, c))) return c;
    return null;
  }
  const mod = spec.replace(/^\./, "").replace(/\./g, "/");
  const c = normalize(join(dirname(file), `${mod}.py`));
  return existsSync(join(root, c)) ? c : null;
}

export function readCode(root: string, path: string, text: string): CodeFile {
  const lang = langOf(path);
  const src = text.replace(/\r/g, "").split("\n");
  const functions: Fn[] = [];
  if (lang !== "other") {
    for (let i = 0; i < src.length; i++) {
      const s = src[i];
      let name: string | undefined, exported = false, params = "";
      if (lang === "ts") {
        const m = s.match(TS_FN) ?? s.match(TS_ARROW);
        if (!m || indentOf(s) > 2) continue;
        if (s.match(TS_ARROW) && !s.match(TS_FN)) {
          const look = src.slice(i, i + 4).join(" ");
          if (!/=>/.test(look) && !/=\s*(async\s+)?function/.test(s)) continue;
        }
        name = m[3]; exported = !!m[2]; params = m[4];
      } else {
        const m = s.match(PY_DEF);
        if (!m || indentOf(s) > 4) continue;
        name = m[2]; exported = !name.startsWith("_"); params = m[3];
      }
      const end = lang === "py" ? pyBlockEnd(src, i) : blockEnd(src, i);
      const doc = docAbove(src, i, lang) || (lang === "py" ? pyDocstring(src, i, end) : "");
      functions.push({ name, line: i + 1, end: end + 1, indent: indentOf(s), exported, doc: doc.slice(0, 400), params: params.trim().slice(0, 160) });
    }
  }
  const imports = lang === "ts" ? tsImports(text, path) : lang === "py" ? pyImports(text) : [];
  const importFiles = [...new Set(imports.map((r) => resolveImport(root, path, r.from, lang)).filter((x): x is string => !!x))];
  return { lang, lines: src.length, doc: fileDoc(src, lang), functions, imports, importFiles, sections: sectionsOf(src) };
}

/** Comments and string contents removed, so a call is only counted where code makes it. */
function codeOnly(body: string, lang: CodeFile["lang"]): string {
  let s = lang === "py" ? body.replace(/#.*$/gm, "") : body.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  if (lang === "ts") s = s.replace(/`(?:[^`\\]|\\.)*`/g, (t) => t.replace(/[^$`{}]+/g, " "));
  return s;
}

export type CallTarget = { file: string; name: string };

/**
 * Calls made inside each function: to functions of the same file, and to functions imported from other files of the
 * same repo. `resolve(file)` returns that file's functions.
 */
export function callsOf(path: string, text: string, cf: CodeFile, root: string, resolve: (file: string) => CodeFile | null): Map<string, CallTarget[]> {
  const src = text.replace(/\r/g, "").split("\n");
  const own = new Set(cf.functions.map((f) => f.name));
  const imported = new Map<string, CallTarget>();
  const namespaces = new Map<string, string>();
  for (const r of cf.imports) {
    const file = resolveImport(root, path, r.from, cf.lang);
    if (!file) continue;
    if (r.ns) { namespaces.set(r.local, file); continue; }
    const other = resolve(file);
    if (other?.functions.some((f) => f.name === r.remote)) imported.set(r.local, { file, name: r.remote });
  }
  const out = new Map<string, CallTarget[]>();
  for (const f of cf.functions) {
    const body = codeOnly(src.slice(f.line - 1, f.end).join("\n").replace(new RegExp(`^[^\\n]*?\\b${f.name}\\b`), ""), cf.lang);
    const found: CallTarget[] = [];
    const add = (t: CallTarget) => { if (!found.some((x) => x.file === t.file && x.name === t.name)) found.push(t); };
    for (const m of body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const n = m[1];
      if (n === f.name) continue;
      if (own.has(n)) add({ file: path, name: n });
      else if (imported.has(n)) add(imported.get(n)!);
    }
    for (const m of body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(/g)) {
      const file = namespaces.get(m[1]);
      if (file && resolve(file)?.functions.some((x) => x.name === m[2])) add({ file, name: m[2] });
    }
    out.set(f.name, found);
  }
  return out;
}
