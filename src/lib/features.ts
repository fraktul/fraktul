// fraktul.dev's features page and the home page's showcase, written as data: what each feature is, the screenshot
// that proves it (src/lib/shots.ts), and the link that opens the same view in the live map.
import { html, type SafeHtml } from "@bascik/bascik/html";
import { SHOTS } from "./shots.ts";

/** A screenshot of the live map that opens the same view when clicked. `sizes` matches the slot it is drawn in. */
export function shot(id: string, sizes = "(max-width: 900px) 92vw, 620px"): SafeHtml {
  const s = SHOTS.find((x) => x.id === id);
  if (!s) throw new Error(`No screenshot called ${id} (src/lib/shots.ts)`);
  return html`<a class="shot" href="/map${s.link}" data-testid="shot-${s.id}">
    <img src="/img/${s.id}-1280.webp" srcset="/img/${s.id}-720.webp 720w, /img/${s.id}-1280.webp 1280w" sizes="${sizes}" width="1280" height="800" alt="${s.alt}" loading="lazy" decoding="async" />
    <span class="shot-open">Open this view live<span aria-hidden="true"> →</span></span>
  </a>`;
}

type Feature = { id: string; eyebrow: string; title: string; body: string[]; points?: string[]; shots?: string[]; code?: { label: string; text: string }; doc?: [string, string] };

const FEATURES: Feature[] = [
  {
    id: "dive", eyebrow: "The map", title: "Click from the whole system down to a line of code",
    body: ["Every level is a diagram. A box with a badge is a door: click it and you are inside, looking at the next diagram down. Blocks open into components, components into files, files into functions, and a function shows its source with every call as a link.", "The top levels are yours, written as plain Mermaid. Everything below a block is read from the code on every build, so the deep levels cannot go stale."],
    points: ["Breadcrumbs and one key take you back up", "Search jumps to any block, file or function", "Works with a mouse, a keyboard or a phone"],
    shots: ["top", "inside"], doc: ["Core concepts", "/docs/concepts"],
  },
  {
    id: "peek", eyebrow: "Orientation", title: "Peek before you jump",
    body: ["Hover a box and a card shows what it is, in the words you wrote, with a small copy of the diagram inside it. You decide whether to go down before you leave the level you are on."],
    shots: ["peek"],
  },
  {
    id: "code", eyebrow: "From the code", title: "Files, functions and who calls whom, with no drawing",
    body: ["Name a file in the model and fraktul draws the rest: its functions, the calls between them, and the functions it reaches in other files. Open a function to see its callers on one side, what it calls on the other, and the source beside it, pinned to the commit that was read.", "Links go to GitHub, GitLab, Bitbucket, Azure DevOps or Gitea. Only files git tracks are read, so ignored or licensed data never ends up in the page."],
    shots: ["source"], doc: ["Diagrams", "/docs/diagrams"],
  },
  {
    id: "big-files", eyebrow: "Readable at any size", title: "A 100-function file, drawn the way a person would",
    body: ["A generated diagram with every call as a line is a hairball. Someone drawing it by hand would group the functions, draw one line between two groups, and leave out the helpers everything uses. fraktul does the same.", "A big file opens as a handful of named groups, taken from the file's own section headings when it has them and from the call flow when it does not. Open a group to see its functions; the rest of the file waits as single boxes around it."],
    points: ["One line between two groups, heavier when the tie is stronger", "Lines to helpers used all over the file are left out", "Long lists of callers stand in columns, not one endless row"],
    shots: ["groups", "group"],
  },
  {
    id: "tours", eyebrow: "Knowledge transfer", title: "Tours that explain the system, in a real voice",
    body: ["A tour is a path through the map: this box, then that one, with a few sentences at each stop and branches where the flow splits. Write what to say and fraktul speaks it with a neural voice that runs on your own Mac. The highlight moves from box to box as the narration reaches them.", "Or record your own: talk while you click, and your voice and every step are saved together. The next person presses play."],
    points: ["Captions follow the voice, word for word", "The check fails when a tour points at a box that is gone", "Nothing is sent to a speech service"],
    shots: ["tour"], doc: ["Tours and narration", "/docs/tours"],
  },
  {
    id: "3d", eyebrow: "A bonus", title: "Walk through it in 3D",
    body: ["Press 3 and the level on screen becomes a place: the same boxes and arrows, standing where the diagram drew them. You start on the ground in front of it with everything in view, or switch to a bird's eye. Shape follows what a thing is, height follows lines of code, and planned blocks are holograms.", "Most people will live in the flat map. The 3D view is there because a system you can stand inside is easier to remember."],
    points: ["Drag to look, WASD to move, click a block to fly in", "Tours fly the camera from stop to stop", "three.js ships with fraktul and loads only when 3D is switched on"],
    shots: ["3d", "3d-bird"], doc: ["3D view", "/docs/3d-view"],
  },
  {
    id: "links", eyebrow: "Sharing", title: "Every view is a link",
    body: ["The address bar always says where you are: the level, the selected box, the stop of a tour, and whether you are in 2D or 3D. Copy it into a pull request, a ticket or a chat and the reader lands on exactly that spot."],
    code: { label: "Links", text: "/map#check                           a level\n/map#check/refs                      a box on it, selected\n/map#fraktul?tour=how-it-works&step=2  a stop on a tour\n/map#check?view=3d                   the level in 3D, from the ground\n/map#check?view=3d&cam=bird          the same, from above" },
    doc: ["Diagrams", "/docs/diagrams"],
  },
  {
    id: "check", eyebrow: "Kept true", title: "A check that fails when the map stops matching the code",
    body: ["Diagrams go stale because nothing complains. fraktul check does: a moved file, a renamed function, a deleted decision record, a diagram box that leads nowhere or a tour step that points at nothing fails the build, and names the block and the path.", "It also lists the files your model does not mention yet. With AI writing much of the code, that list is how the picture keeps up."],
    code: { label: "Shell", text: "$ npx fraktul check\n8 nodes, 8 diagrams, 8 tours (43 steps)\n\n1 broken reference:\n  ✗ node api: file src/api/orders.ts is not in the repo\n    (moved, renamed, deleted, or not tracked by git)" },
    doc: ["The check in CI", "/docs/ci"],
  },
  {
    id: "publish", eyebrow: "Shipping it", title: "One static page, hosted anywhere",
    body: ["fraktul build writes a folder: one page, the diagrams' data, and the audio. Any static host serves it, and it loads no code from a CDN. For a private codebase, a public build keeps the structure and leaves out the source and the links into the repo."],
    doc: ["Publishing", "/docs/publishing"],
  },
];

const MORE: [string, string][] = [
  ["Starts itself", "fraktul init writes a first model from your project's folders. It passes the check as written; you add the words and the arrows."],
  ["Live facts", "Show numbers and lists read from the project at build time: the latest test run, open decisions, a table of rules."],
  ["Decision records", "Point a block at its ADRs. The panel lists them with their status, and the check fails when one is deleted."],
  ["Several repos", "One map can span repositories, each linked to its own host. Repos that are not checked out are skipped, not broken."],
  ["Two styles, light and dark", "A quiet flat style by default and a liquid-chrome y2k style, both meeting WCAG AA contrast."],
  ["Phones", "The map pans, pinches and taps. Hover peeks become taps; the details panel folds away."],
];

/** The features page: one section per feature, pictures and copy on alternating sides. */
export function featuresPage(): SafeHtml {
  return html`<header class="docs-hero feat-hero">
    <div class="feat-hero-inner">
      <p class="docs-eyebrow">Features</p>
      <h1 class="docs-hero-title">Everything a map of your system should do</h1>
      <p class="docs-lede">fraktul turns one model file and your code into a map people can explore, a check that keeps it true, and tours that explain it. Every picture on this page is the live map: click one to open that view.</p>
      <div class="docs-hero-ctas"><a class="pill main" href="/map">Open the live map</a><a class="pill" href="/docs/getting-started">Quickstart</a></div>
      <nav class="feat-toc" aria-label="On this page">${FEATURES.map((f) => html`<a href="#${f.id}">${f.eyebrow}</a>`)}</nav>
    </div>
  </header>
  ${FEATURES.map((f, i) => html`<section class="feat${i % 2 ? " flip" : ""}${f.shots?.length || f.code ? "" : " solo"}" id="${f.id}" aria-labelledby="${f.id}-title">
    <div class="feat-copy">
      <p class="docs-eyebrow">${f.eyebrow}</p>
      <h2 class="y2k-head" id="${f.id}-title">${f.title}</h2>
      ${f.body.map((p) => html`<p>${p}</p>`)}
      ${f.points ? html`<ul>${f.points.map((p) => html`<li>${p}</li>`)}</ul>` : ""}
      ${f.doc ? html`<p class="feat-doc"><a href="${f.doc[1]}">Read the docs: ${f.doc[0]}<span aria-hidden="true"> →</span></a></p>` : ""}
    </div>
    ${f.shots?.length || f.code ? html`<div class="feat-media">
      ${(f.shots ?? []).map((s) => shot(s))}
      ${f.code ? html`<div class="code-block"><div class="code-bar"><span>${f.code.label}</span></div><pre><code>${f.code.text}</code></pre></div>` : ""}
    </div>` : ""}
  </section>`)}
  <section class="feat-more" aria-labelledby="more-title">
    <h2 class="y2k-head" id="more-title">And the rest</h2>
    <ul>${MORE.map(([t, d]) => html`<li class="y2k-card"><h3>${t}</h3><p>${d}</p></li>`)}</ul>
  </section>
  <section class="feat-end">
    <h2 class="y2k-head">Map your own system</h2>
    <div class="code-block"><div class="code-bar"><span>Shell</span><button class="copy" type="button" aria-label="Copy code">Copy</button></div><pre><code>npm install --save-dev fraktul\nnpx fraktul init\nnpx fraktul dev</code></pre></div>
    <div class="docs-hero-ctas"><a class="pill main" href="/docs/getting-started">Read the quickstart</a><a class="pill" href="/docs">All documentation</a></div>
  </section>`;
}

/** The home page's showcase: the same screenshots as tabs. */
export const SHOWCASE: { shot: string; tab: string; title: string; text: string }[] = [
  { shot: "top", tab: "The map", title: "Start with the whole system", text: "The top level is the picture you would draw on a whiteboard, written as a few lines of Mermaid. Every box with a badge opens." },
  { shot: "inside", tab: "One level down", title: "Click a box, land inside it", text: "Each block has its own diagram and its own panel: what it does, the files and functions behind it, the decisions that shaped it." },
  { shot: "tour", tab: "A tour", title: "Follow the flow, narrated", text: "Tours walk a newcomer through the system one stop at a time, in a real voice, with the highlight moving as it talks." },
  { shot: "groups", tab: "A big file", title: "Hundreds of functions, still readable", text: "Big files are drawn as named groups with one line between them, the way a careful person would draw them by hand." },
  { shot: "source", tab: "The code", title: "All the way to the source", text: "A function shows who calls it, what it calls, and its code, linked to the exact commit on your git host." },
  { shot: "3d", tab: "3D", title: "And, because it is fun, in 3D", text: "The same level as a place you can walk through, from the ground or a bird's eye. Every view, flat or 3D, is a link you can share." },
];

/** The showcase markup: a row of tabs and one panel per screenshot. The home-showcase component wires the tabs. */
export function showcase(): SafeHtml {
  return html`<div class="show-tabs" role="tablist" aria-label="What the map looks like">
    ${SHOWCASE.map((s, i) => html`<button class="show-tab" type="button" role="tab" aria-selected="${i === 0 ? "true" : "false"}" tabindex="${i === 0 ? "0" : "-1"}" data-show-tab="${s.shot}" data-testid="home-showcase-tab-${s.shot}">${s.tab}</button>`)}
  </div>
  ${SHOWCASE.map((s, i) => {
    const inner = html`<div class="show-screen y2k-screen">${shot(s.shot, "(max-width: 900px) 92vw, 760px")}</div>
    <div class="show-copy"><h3>${s.title}</h3><p>${s.text}</p></div>`;
    // Every panel but the first starts hidden; the tabs switch them.
    return i === 0
      ? html`<div class="show-panel" role="tabpanel" aria-label="${s.tab}" data-show-panel="${s.shot}">${inner}</div>`
      : html`<div class="show-panel" role="tabpanel" aria-label="${s.tab}" data-show-panel="${s.shot}" hidden>${inner}</div>`;
  })}`;
}
