// fraktul.dev documentation: Markdown files in content/docs (NN-slug.md with a title and summary in front matter),
// rendered at build time. The text is fraktul's own, so the rendered HTML is trusted.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { html, raw, type SafeHtml } from "@bascik/bascik/html";
import { marked } from "marked";
import { FRAKTUL } from "./model.ts";

export type Doc = { slug: string; order: number; title: string; summary: string; body: string };

export function loadDocs(): Doc[] {
  const dir = join(FRAKTUL, "content", "docs");
  return readdirSync(dir).filter((f) => /^\d+-[a-z0-9-]+\.md$/.test(f)).sort().map((f) => {
    const text = readFileSync(join(dir, f), "utf8");
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const front = Object.fromEntries((m?.[1] ?? "").split("\n").map((l) => l.split(/:\s(.+)/).slice(0, 2)).filter((p) => p.length === 2));
    return { slug: f.replace(/^\d+-/, "").replace(/\.md$/, ""), order: Number(f.slice(0, 2)), title: front.title ?? f, summary: front.summary ?? "", body: m?.[2] ?? text };
  });
}

/** One docs page: the sidebar, the article, and previous / next. */
export function docPage(slug: string): SafeHtml {
  const docs = loadDocs();
  const i = docs.findIndex((d) => d.slug === slug);
  const doc = docs[i];
  const prev = docs[i - 1], next = docs[i + 1];
  const article = raw(marked.parse(doc.body, { async: false }) as string);
  return html`<div class="docs-layout">
    <nav class="docs-nav" aria-label="Documentation">
      <a class="docs-home" href="/docs">Documentation</a>
      <ol>${docs.map((d) => (d.slug === slug ? html`<li><a href="/docs/${d.slug}" aria-current="page">${d.title}</a></li>` : html`<li><a href="/docs/${d.slug}">${d.title}</a></li>`))}</ol>
    </nav>
    <article class="prose">
      <p class="docs-eyebrow">Docs · ${String(i + 1).padStart(2, "0")}</p>
      <h1 class="y2k-head">${doc.title}</h1>
      <p class="docs-lede">${doc.summary}</p>
      ${article}
      <div class="docs-pager">
        ${prev ? html`<a class="pg prev" href="/docs/${prev.slug}"><small>Previous</small>${prev.title}</a>` : html`<span></span>`}
        ${next ? html`<a class="pg next" href="/docs/${next.slug}"><small>Next</small>${next.title}</a>` : html`<span></span>`}
      </div>
    </article>
  </div>`;
}

/** The docs hub: one card per page. */
export function docsIndex(): SafeHtml {
  return html`<ol class="docs-cards">${loadDocs().map((d, i) => html`<li class="y2k-card"><a href="/docs/${d.slug}"><span class="docs-eyebrow">${String(i + 1).padStart(2, "0")}</span><strong>${d.title}</strong><span>${d.summary}</span></a></li>`)}</ol>`;
}
