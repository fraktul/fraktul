// fraktul.dev documentation: Markdown files in content/docs (NN-slug.md with `title`, `summary` and `section` in front
// matter), rendered at build time. The text is fraktul's own, so the rendered HTML is trusted.
//
// On top of plain Markdown:
//   - h2 and h3 get ids and a # anchor, and the page lists them as "On this page";
//   - code blocks get a bar with their language and a copy button (wired by the docs-enhance component);
//   - a blockquote starting with [!NOTE], [!TIP] or [!WARNING] is a callout.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { html, raw, type SafeHtml } from "@bascik/bascik/html";
import { Marked, type Tokens } from "marked";
import { FRAKTUL } from "./model.ts";

export type Heading = { depth: number; id: string; text: string };
export type Doc = { slug: string; order: number; title: string; summary: string; section: string; body: string };

/** Sections in sidebar order; a page names one in its front matter (default: the last one). */
export const SECTIONS = ["Start", "Concepts", "Guides", "Reference"] as const;
const BLURB: Record<string, string> = {
  Start: "What fraktul is, and a map of your own project in a few minutes.",
  Concepts: "The ideas the rest builds on: blocks, levels, anchors, the check.",
  Guides: "Tours, voices, recordings, live facts, 3D, styles and publishing.",
  Reference: "Every command and flag, and answers when something goes wrong.",
};

export function loadDocs(): Doc[] {
  const dir = join(FRAKTUL, "content", "docs");
  const docs = readdirSync(dir).filter((f) => /^\d+-[a-z0-9-]+\.md$/.test(f)).sort().map((f) => {
    const text = readFileSync(join(dir, f), "utf8");
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const front = Object.fromEntries((m?.[1] ?? "").split("\n").map((l) => l.split(/:\s(.+)/).slice(0, 2)).filter((p) => p.length === 2));
    const section = SECTIONS.includes(front.section) ? front.section : SECTIONS[SECTIONS.length - 1];
    return { slug: f.replace(/^\d+-/, "").replace(/\.md$/, ""), order: parseInt(f, 10), title: front.title ?? f, summary: front.summary ?? "", section, body: m?.[2] ?? text };
  });
  // Grouped by section, in file order within each.
  return SECTIONS.flatMap((s) => docs.filter((d) => d.section === s));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plainText = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const slugify = (s: string) => s.toLowerCase().replace(/[`'"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";

/** Light colouring for the examples: comments, and keys in YAML. Works on escaped text, one line at a time. */
function tint(code: string, lang: string): string {
  return code.split("\n").map((line) => {
    let l = esc(line);
    const hash = lang === "yaml" || lang === "bash" || lang === "sh" || lang === "text";
    const cm = hash ? l.match(/(^|\s)(#(?:\s.*)?)$/) : lang === "ts" || lang === "js" ? l.match(/(^|\s)(\/\/.*)$/) : null;
    let comment = "";
    if (cm && cm.index !== undefined) { comment = `<span class="c">${cm[2]}</span>`; l = l.slice(0, cm.index + cm[1].length); }
    if (lang === "yaml") l = l.replace(/^(\s*(?:-\s+)?)([A-Za-z_"*][\w"*-]*)(:)(?=\s|$)/, '$1<span class="k">$2</span>$3');
    return l + comment;
  }).join("\n");
}

const LANG: Record<string, string> = { yaml: "YAML", bash: "Shell", sh: "Shell", ts: "TypeScript", js: "JavaScript", json: "JSON", text: "Text", mermaid: "Mermaid" };

/** Renders one page's Markdown and collects its h2/h3 headings. */
function render(body: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const used = new Set<string>();
  const md = new Marked({
    renderer: {
      heading(this: any, { tokens, depth }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        if (depth > 3) return `<h${depth}>${inner}</h${depth}>\n`;
        let id = slugify(plainText(inner));
        for (let n = 2; used.has(id); n++) id = `${slugify(plainText(inner))}-${n}`;
        used.add(id);
        if (depth >= 2) headings.push({ depth, id, text: plainText(inner) });
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${inner}</h${depth}>\n`;
      },
      code({ text, lang }: Tokens.Code) {
        const l = (lang ?? "").trim().split(/\s/)[0];
        return `<div class="code-block"><div class="code-bar"><span>${esc(LANG[l] ?? l ?? "")}</span><button class="copy" type="button" aria-label="Copy code">Copy</button></div><pre><code${l ? ` class="language-${esc(l)}"` : ""}>${tint(text, l)}</code></pre></div>\n`;
      },
      blockquote(this: any, { tokens }: Tokens.Blockquote) {
        const inner: string = this.parser.parse(tokens);
        const m = inner.match(/^<p>\[!(NOTE|TIP|WARNING)\]\s*/);
        if (!m) return `<blockquote>${inner}</blockquote>\n`;
        const kind = m[1].toLowerCase();
        const label = { note: "Note", tip: "Tip", warning: "Watch out" }[kind];
        return `<aside class="callout ${kind}"><p class="callout-label">${label}</p><p>${inner.slice(m[0].length)}</aside>\n`;
      },
      table(this: any, token: Tokens.Table) {
        // Tables scroll on their own on a narrow screen instead of widening the page.
        const head = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join("");
        // Each cell carries its column's name, so a phone can show rows as small cards.
        const names = token.header.map((c) => esc(plainText(this.parser.parseInline(c.tokens))));
        const rows = token.rows.map((r) => `<tr>${r.map((c, i) => `<td data-label="${names[i]}">${this.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`).join("");
        return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });
  const out = md.parse(body, { async: false }) as string;
  return { html: out, headings };
}

const arrow = (dir: "l" | "r") => raw(`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${dir === "l" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}" /></svg>`);

/** The sidebar: pages grouped by section. Inside a <details> so it folds into one row on a phone. */
function sidebar(docs: Doc[], slug: string): SafeHtml {
  const current = docs.find((d) => d.slug === slug);
  return html`<nav class="docs-nav" aria-label="Documentation">
    <details class="docs-nav-fold" open>
      <summary><span>Documentation</span><small>${current?.title ?? ""}</small></summary>
      <ol class="docs-overview"><li><a href="/docs">Overview</a></li></ol>
      ${SECTIONS.filter((s) => docs.some((d) => d.section === s)).map((s) => html`<p class="docs-nav-head">${s}</p>
      <ol>${docs.filter((d) => d.section === s).map((d) => (d.slug === slug ? html`<li><a href="/docs/${d.slug}" aria-current="page">${d.title}</a></li>` : html`<li><a href="/docs/${d.slug}">${d.title}</a></li>`))}</ol>`)}
    </details>
  </nav>`;
}

/** One docs page: the sidebar, the article, "On this page", and previous / next. */
export function docPage(slug: string): SafeHtml {
  const docs = loadDocs();
  const i = docs.findIndex((d) => d.slug === slug);
  const doc = docs[i];
  const prev = docs[i - 1], next = docs[i + 1];
  const { html: body, headings } = render(doc.body);
  const toc = headings.filter((h) => h.depth === 2 || h.depth === 3);
  // Every page with sections lists them, however few: a reader should find "On this page" in the same place each time.
  const hasToc = toc.length > 0;
  return html`<div class="docs-layout${hasToc ? " has-toc" : ""}">
    ${sidebar(docs, slug)}
    <article class="prose" data-testid="docs-article">
      <header class="docs-title">
        <p class="docs-eyebrow">${doc.section}</p>
        <h1 class="y2k-head">${doc.title}</h1>
        <p class="docs-lede">${doc.summary}</p>
      </header>
      ${raw(body)}
      <nav class="docs-pager" aria-label="Previous and next">
        ${prev ? html`<a class="pg prev" href="/docs/${prev.slug}">${arrow("l")}<span><small>Previous</small>${prev.title}</span></a>` : html`<span></span>`}
        ${next ? html`<a class="pg next" href="/docs/${next.slug}"><span><small>Next</small>${next.title}</span>${arrow("r")}</a>` : html`<span></span>`}
      </nav>
    </article>
    ${hasToc ? html`<aside class="docs-toc" aria-label="On this page">
      <p class="docs-nav-head">On this page</p>
      <ol>${toc.map((h) => html`<li><a href="#${h.id}" data-level="${h.depth}">${h.text}</a></li>`)}</ol>
    </aside>` : ""}
  </div>`;
}

/** The docs hub: the sections, each with one card per page. */
export function docsIndex(): SafeHtml {
  const docs = loadDocs();
  let n = 0;
  return html`${SECTIONS.filter((s) => docs.some((d) => d.section === s)).map((s) => html`<section class="docs-group" aria-labelledby="sec-${s.toLowerCase()}">
    <div class="docs-group-head">
      <h2 class="y2k-head" id="sec-${s.toLowerCase()}">${s}</h2>
      <p>${BLURB[s] ?? ""}</p>
    </div>
    <ol class="docs-cards">${docs.filter((d) => d.section === s).map((d) => html`<li><a class="docs-card" href="/docs/${d.slug}"><span class="docs-num">${String(++n).padStart(2, "0")}</span><strong>${d.title}</strong><span class="docs-sum">${d.summary}</span></a></li>`)}</ol>
  </section>`)}`;
}
