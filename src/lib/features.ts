// fraktul.dev's features page, its two argument pages (AI, living docs) and the home page's showcase, written as data: what each feature is, the screenshot
// that proves it (src/lib/shots.ts), and the link that opens the same view in the live map.
import { html, type SafeHtml } from "@bascik/bascik/html";
import { SHOTS } from "./shots.ts";

/** A screenshot of the live map that opens the same view when clicked. `sizes` matches the slot it is drawn in. */
export function shot(id: string, sizes = "(max-width: 900px) 92vw, 620px"): SafeHtml {
  const s = SHOTS.find((x) => x.id === id);
  if (!s) throw new Error(`No screenshot called ${id} (src/lib/shots.ts)`);
  return html`<a class="shot" href="${(s.map ?? "/map") + s.link}" data-testid="shot-${s.id}">
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
    id: "levels", eyebrow: "Every altitude", title: "Systems, services, features, files, functions",
    body: ["Most diagrams show one altitude. A fraktul map has all of them: the whole system from 30,000 feet, each service, each feature step by step, then the files and functions the code itself provides.", "Use the top of it to explain even a complex system to someone non-technical. The same map takes an engineer from that picture down to the function they need to change."],
    points: ["Each block says which level it is: system, service or feature", "A small app needs two written levels; a platform needs three or four", "A tour that stays on the top two levels explains the system to anyone"],
    shots: ["shop"], doc: ["Levels", "/docs/levels"],
  },
  {
    id: "ai", eyebrow: "Written by AI", title: "Your assistant writes the map",
    body: ["The model is a plain text file, and a check says when it is wrong, so an AI coding assistant can write it. Install the fraktul skill and ask for a map. The assistant reads the code, writes the levels and reruns the check until every file and function it named exists.", "You review what the check cannot: whether the words are true, and whether the picture is the one you would draw."],
    code: { label: "Shell", text: "$ npx fraktul skill\nfraktul: .claude/skills/fraktul\nfraktul: .agents/skills/fraktul\n\n> Map this system with fraktul." },
    doc: ["Map it with AI", "/docs/ai"],
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
    body: ["Press 3 and the level on screen becomes a place: the same boxes and arrows, standing where the diagram drew them. You start on the ground in front of it with everything in view, or switch to a bird's eye. Shape follows what a thing is, height follows lines of code, and planned blocks are holograms.", "Most people will use the flat map. The 3D view is a bonus, and it is there because walking through a system is fun."],
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
    body: ["Diagrams go stale because nothing complains. fraktul check does: a moved file, a renamed function, a deleted decision record, a diagram box that leads nowhere or a tour step that points at nothing fails the build, and names the block and the path.", "It also lists the files your model does not mention yet. With AI writing most of the code, that list is how the map keeps up."],
    code: { label: "Shell", text: "$ npx fraktul check\n8 nodes, 8 diagrams, 8 tours (43 steps)\n\n1 broken reference:\n  ✗ node api: file src/api/orders.ts is not in the repo\n    (moved, renamed, deleted, or not tracked by git)" },
    doc: ["The check in CI", "/docs/ci"],
  },
  {
    id: "traces", eyebrow: "From production", title: "What your traces say, next to what you drew",
    body: ["Code shows what a service contains. Traces show which services really talk to each other. fraktul reads OpenTelemetry traces from Jaeger or the Collector and boils them down to services and the calls between them.", "Each service's panel then shows its real traffic: who calls it, what it calls, how often and how fast. And the check lists every call the traces show that no diagram draws."],
    points: ["Works with any OpenTelemetry setup: OTLP files or a Jaeger address", "Keeps counts and latency only: no payloads, no attribute values", "Databases and queues show up too, by the system they are"],
    shots: ["traces"], doc: ["Traces", "/docs/traces"],
  },
  {
    id: "publish", eyebrow: "Shipping it", title: "One static page, hosted anywhere",
    body: ["fraktul build writes a folder: one page, the diagrams' data, and the audio. Any static host serves it, and it loads no code from a CDN. For a private codebase, a public build keeps the structure and leaves out the source and the links into the repo."],
    doc: ["Publishing", "/docs/publishing"],
  },
];

const MORE: [string, string][] = [
  ["Starts itself", "fraktul init writes a first model from your project's folders and installs the agent skill. The model passes the check as written."],
  ["Live facts", "Show numbers and lists read from the project at build time: the latest test run, open decisions, a table of rules."],
  ["Decision records", "Point a block at its ADRs. The panel lists them with their status, and the check fails when one is deleted."],
  ["Several repos", "One map can span repositories, each linked to its own host. Repos that are not checked out are skipped, not broken."],
  ["Two styles, light and dark", "A quiet flat style by default and a liquid-chrome y2k style, both meeting WCAG AA contrast."],
  ["Phones", "The map pans, pinches and taps. Hover peeks become taps; the details panel folds away."],
];

type Page = { eyebrow: string; title: string; lede: string; ctas: [string, string][]; sections: Feature[]; more?: [string, string][]; end: { title: string; code: string; ctas: [string, string][] } };

const START = { title: "Map your own system", code: "npm install --save-dev fraktul\nnpx fraktul skill\nnpx fraktul init\nnpx fraktul dev", ctas: [["Read the quickstart", "/docs/getting-started"], ["All documentation", "/docs"]] as [string, string][] };

/** fraktul.dev's pages that are a hero and a run of sections: the features page and the two that argue one point each. */
export const SITE_PAGES: Record<string, Page> = {
  features: {
    eyebrow: "Features", title: "Everything a map of your system should do",
    lede: "fraktul turns one model file and your code into a map people can explore, a check that keeps it true, and tours that explain it. Every picture on this page is a live map: click one to open that view.",
    ctas: [["Open the live map", "/map"], ["Quickstart", "/docs/getting-started"]], sections: FEATURES, more: MORE, end: START,
  },
  ai: {
    eyebrow: "Mapping with AI", title: "Your AI assistant can write the whole map",
    lede: "Give your AI coding assistant the fraktul skill and ask for a map. It reads the code and writes the model. A check then proves that every file, function and tour step it named exists.",
    ctas: [["Set it up", "/docs/ai"], ["Open a finished map", "/map"]],
    sections: [
      {
        id: "skill", eyebrow: "One command", title: "One command installs the skill",
        body: ["fraktul ships an agent skill: the instructions an assistant needs to map a system well. Which levels to write, how many boxes a diagram can hold, how to phrase a summary a non-engineer understands, and how to work the check until it passes.", "It installs into .claude/skills and .agents/skills, the two folders that Claude Code, GitHub Copilot, Cursor, Codex and Gemini CLI read skills from. Commit them and the whole team has it."],
        code: { label: "Shell", text: "$ npm install --save-dev fraktul\n$ npx fraktul skill\nfraktul: .claude/skills/fraktul\nfraktul: .agents/skills/fraktul" },
        doc: ["Map it with AI", "/docs/ai"],
      },
      {
        id: "ask", eyebrow: "One sentence", title: "Ask for a map in one sentence",
        body: ["The assistant reads the README, the routes and the deploy files, finds the three to seven big parts, and writes each level down to where the code can take over. Then it runs the check, fixes what it got wrong, and writes the tour a new teammate should take first.", "After that, ask for more: another level under one service, a tour for a non-technical audience, or the calls your traces show that the map is missing."],
        code: { label: "Prompts", text: "Map this system with fraktul.\n\nAdd a level under checkout: its features, one block each.\n\nWrite a tour that follows one order from the browser\nto the bank, for someone non-technical.\n\nPull the traces from our Jaeger and draw the calls\nthe map is missing." },
      },
      {
        id: "honest", eyebrow: "The guardrail", title: "When the assistant gets it wrong, the check says so",
        body: ["An AI will sometimes name a file that does not exist or a function that was renamed last week. In a wiki page nobody would notice. In a fraktul model the check fails and says exactly which reference is wrong, so the assistant fixes it before you ever see it.", "Below the levels it wrote, nothing is generated by a model at all: files, functions, calls and source are read straight from the code."],
        code: { label: "Shell (an example)", text: "$ npx fraktul check\n2 broken references:\n  ✗ node payments: file src/pay/stripe.ts is not in the repo\n  ✗ tour first-order step 4: focus \"ledger\" is not a box in payments\n\n$ npx fraktul check\nAll references resolve." },
        doc: ["The check in CI", "/docs/ci"],
      },
      {
        id: "review", eyebrow: "Your part", title: "What is left for you to review",
        body: ["The check proves the map matches the code. It cannot prove the words are true. That part is yours: whether each summary is what you would tell a new teammate, and whether the top diagram is the one you would draw on a whiteboard.", "The skill tells the assistant to list what it guessed, so you know where to look."],
        points: ["Summaries: what the part is for, in plain words", "Arrows: the flow you would draw yourself", "What was left out, and whether you agree"],
      },
      {
        id: "current", eyebrow: "Every change after", title: "The assistant that writes the code updates the map",
        body: ["AI now writes most of the code. The same assistant can keep the map current: tell it once that the project has a map, and every change that moves a file or adds a module updates the model in the same pull request.", "When it forgets, the check in CI fails and the fix is one line."],
        code: { label: "AGENTS.md", text: "This project has a fraktul map (docs/arch/model.yaml).\nWhen you add, move or rename code, update the model in\nthe same change and run `npx fraktul check` before you finish." },
        doc: ["Keeping the map true", "/docs/keeping-it-true"],
      },
    ],
    end: START,
  },
  demo: {
    eyebrow: "The demo", title: "A real system, mapped: twenty services and their traces",
    lede: "fraktul's own map is one small tool. This one is the OpenTelemetry project's demo application, an open-source online shop: about twenty services in a dozen languages, with a database, a cache and a queue. Open it, or run it yourself in five commands.",
    ctas: [["Open the shop's map", "/shop/"], ["Run it yourself", "/docs/demo"], ["fraktul's own map", "/map"]],
    sections: [
      {
        id: "top", eyebrow: "30,000 feet", title: "Nine boxes explain twenty services",
        body: ["The top level is what you would tell someone who has never seen the code: a shopper, a storefront, and the six things the shop does. Browsing, the cart, checkout, paying, delivery, and what happens after the order.", "Each box opens. A feature shows the services that make it happen; a service shows what it does and what it talks to."],
        shots: ["shop"],
      },
      {
        id: "traffic", eyebrow: "From its traces", title: "Every service shows the traffic it really had",
        body: ["The shop was run in Docker with its load generator, and its OpenTelemetry traces were read into the map: 315 traces, 17 services, 24 kinds of call. Select checkout and the panel lists who calls it and the eight things it calls for every order, with counts and latency.", "The check compares those calls with the arrows in the diagrams. Nothing was missing, and it found three arrows the short capture never saw."],
        shots: ["traces"], doc: ["Traces", "/docs/traces"],
      },
      {
        id: "down", eyebrow: "All the way down", title: "From the shop to a function in four clicks",
        body: ["Open the storefront, then one of its API routes, then a function. The file and function levels are read from the demo's source, so they show the code as it is at the pinned release, linked to GitHub."],
        code: { label: "The way down", text: "Astronomy Shop            system\n  └ Storefront            service\n      └ pages/api/checkout.ts   file\n          └ handler()            function, with its source" },
      },
      {
        id: "tours", eyebrow: "For everyone", title: "Four narrated tours, from a two-minute overview to one order",
        body: ["\"The shop in two minutes\" stays at the top level and explains the whole system in six stops, in words a shopper would understand. \"Follow one order\" goes down into checkout and walks a purchase through the services, to the message on the queue.", "Two more cover how a product page is built and what keeps the shop running. Press Listen on any of them: the voice was generated on a Mac, and the highlight moves with it."],
        code: { label: "Links", text: "/shop/#shop?tour=the-shop-in-two-minutes&step=1\n/shop/#shop?tour=follow-one-order&step=1\n/shop/#storefront?tour=how-a-page-is-built&step=1\n/shop/#basket?tour=keeping-the-shop-running&step=1" },
        doc: ["Tours and narration", "/docs/tours"],
      },
      {
        id: "run", eyebrow: "Yours to run", title: "Five commands, no Docker",
        body: ["Clone the demo, let fraktul put the map in it, and open it. Then break it: rename a file the map names, or delete an arrow the traces can see, and watch the check fail.", "The map and its traces are also in fraktul's repository, with a script that runs the shop in Docker and reads fresh traces."],
        code: { label: "Shell", text: "git clone --depth 1 --branch 2.1.3 \\\n  https://github.com/open-telemetry/opentelemetry-demo.git\ncd opentelemetry-demo\nnpx fraktul example shop\nnpx fraktul check\nnpx fraktul dev" },
        doc: ["The demo shop", "/docs/demo"],
      },
    ],
    end: START,
  },
  "living-docs": {
    eyebrow: "Documentation that stays true", title: "A map that says when it has gone out of date",
    lede: "We all know diagrams go out of date almost as soon as they are drawn. A service is split, a queue is added, a module is renamed, and nothing tells anyone to update the picture. fraktul's check fails when the map is wrong, so it gets fixed in the pull request that caused it.",
    ctas: [["The routine", "/docs/keeping-it-true"], ["Connect your traces", "/docs/traces"]],
    sections: [
      {
        id: "why-stale", eyebrow: "The real problem", title: "Diagrams go stale because nothing fails",
        body: ["Code that is wrong fails a test. A diagram that is wrong just sits there. After a few months nobody can say which parts are still true, so the team goes back to asking the one person who remembers.", "What fixes that is a map that can fail."],
      },
      {
        id: "moved", eyebrow: "Drift, one", title: "The code moved",
        body: ["Every block in the model names the code behind it: files, functions, decision records. When one of them is renamed, moved or deleted, fraktul check fails and names the block and the path. Run it on every pull request and the person who moved the file fixes the map before it merges."],
        code: { label: "Shell", text: "$ npx fraktul check\n1 broken reference:\n  ✗ node api: file src/api/orders.ts is not in the repo\n    (moved, renamed, deleted, or not tracked by git)" },
        doc: ["The check in CI", "/docs/ci"],
      },
      {
        id: "grew", eyebrow: "Drift, two", title: "The code grew, and the map did not",
        body: ["New code is the quieter failure: a module nobody put on any diagram. Tell fraktul which files matter and it lists every one the map does not mention. In strict mode new code cannot merge until it has a place.", "With AI writing most of the code, this list is how the map keeps up with the repository."],
        code: { label: "Shell", text: "$ npx fraktul check --strict\nIn the repo but not in the model yet (2 files):\n  file  src/billing/dunning.ts\n  file  src/billing/retry.ts" },
      },
      {
        id: "production", eyebrow: "Drift, three", title: "Production says something else",
        body: ["The repository shows what each service contains. It does not show which services really call each other: that lives in your traces. fraktul reads OpenTelemetry traces from Jaeger or the Collector, and compares the calls it sees with the arrows the model draws.", "A call that happens but is not drawn gets listed. A service that appears in the traces and on no diagram gets listed. Each service's panel shows its real traffic: who calls it, what it calls, how often, how fast."],
        shots: ["traces"],
        code: { label: "Shell", text: "$ npx fraktul traces http://jaeger.internal:16686\n$ npx fraktul check\nAgainst the traces: 1 call not drawn, 1 service not on the map\n  call     Checkout → Email happens (417 calls) but no diagram draws it\n  service  fraud-detection is in the traces; no block says service: fraud-detection" },
        doc: ["Traces", "/docs/traces"],
      },
      {
        id: "below", eyebrow: "No drift at all", title: "Below what you wrote, nothing can go stale",
        body: ["The file and function levels are read from the code on every build: the functions in a file, who calls whom, and the source itself, linked to the commit it was read from. There is nothing there to keep up to date."],
        shots: ["source"],
      },
      {
        id: "together", eyebrow: "One place", title: "The whole system, kept together",
        body: ["Architecture lives in slides, service docs in each repo, decisions in a folder, the call graph in an observability tool, and the walkthrough in someone's head. One fraktul map spans every repo of a system and holds all of it: the picture, the code behind it, the decisions, the real traffic and the narrated tour.", "It builds to a static page on every merge, so the published map is always the map of main."],
        doc: ["Publishing", "/docs/publishing"],
      },
    ],
    end: START,
  },
};

/** One of those pages: a hero, then one section per point, pictures and copy on alternating sides. */
export function sitePage(id: string): SafeHtml {
  const p = SITE_PAGES[id];
  if (!p) throw new Error(`No site page called ${id} (src/lib/features.ts)`);
  return html`<header class="docs-hero feat-hero">
    <div class="feat-hero-inner">
      <p class="docs-eyebrow">${p.eyebrow}</p>
      <h1 class="docs-hero-title">${p.title}</h1>
      <p class="docs-lede">${p.lede}</p>
      <div class="docs-hero-ctas">${p.ctas.map(([label, href], i) => (i === 0 ? html`<a class="pill main" href="${href}">${label}</a>` : html`<a class="pill" href="${href}">${label}</a>`))}</div>
      <nav class="feat-toc" aria-label="On this page">${p.sections.map((f) => html`<a href="#${f.id}">${f.eyebrow}</a>`)}</nav>
    </div>
  </header>
  ${p.sections.map((f, i) => html`<section class="feat${i % 2 ? " flip" : ""}${f.shots?.length || f.code ? "" : " solo"}" id="${f.id}" aria-labelledby="${f.id}-title">
    <div class="feat-copy">
      <p class="docs-eyebrow">${f.eyebrow}</p>
      <h2 class="y2k-head" id="${f.id}-title">${f.title}</h2>
      ${f.body.map((b) => html`<p>${b}</p>`)}
      ${f.points ? html`<ul>${f.points.map((x) => html`<li>${x}</li>`)}</ul>` : ""}
      ${f.doc ? html`<p class="feat-doc"><a href="${f.doc[1]}">Read the docs: ${f.doc[0]}<span aria-hidden="true"> →</span></a></p>` : ""}
    </div>
    ${f.shots?.length || f.code ? html`<div class="feat-media">
      ${(f.shots ?? []).map((s) => shot(s))}
      ${f.code ? html`<div class="code-block"><div class="code-bar"><span>${f.code.label}</span></div><pre><code>${f.code.text}</code></pre></div>` : ""}
    </div>` : ""}
  </section>`)}
  ${p.more ? html`<section class="feat-more" aria-labelledby="more-title">
    <h2 class="y2k-head" id="more-title">And the rest</h2>
    <ul>${p.more.map(([t, d]) => html`<li class="y2k-card"><h3>${t}</h3><p>${d}</p></li>`)}</ul>
  </section>` : ""}
  <section class="feat-end">
    <h2 class="y2k-head">${p.end.title}</h2>
    <div class="code-block"><div class="code-bar"><span>Shell</span><button class="copy" type="button" aria-label="Copy code">Copy</button></div><pre><code>${p.end.code}</code></pre></div>
    <div class="docs-hero-ctas">${p.end.ctas.map(([label, href], i) => (i === 0 ? html`<a class="pill main" href="${href}">${label}</a>` : html`<a class="pill" href="${href}">${label}</a>`))}</div>
  </section>`;
}

/** The home page's showcase: the same screenshots as tabs. */
export const SHOWCASE: { shot: string; tab: string; title: string; text: string }[] = [
  { shot: "top", tab: "The map", title: "Start with the whole system", text: "The top level is the picture you would draw on a whiteboard, written as a few lines of Mermaid. Every box with a badge opens." },
  { shot: "inside", tab: "One level down", title: "Click a box, land inside it", text: "Each block has its own diagram and its own panel: what it does, the files and functions behind it, the decisions that shaped it." },
  { shot: "traces", tab: "A whole platform", title: "Twenty services, and what they really do", text: "The OpenTelemetry demo shop, mapped from its code and its traces. Each service's panel shows who calls it and how often, read from production." },
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

/** The home page's demo band: the shop's top level, what it is, and the two ways in. */
export function demoBand(): SafeHtml {
  return html`<div class="show-panel demo-band">
    <div class="show-copy">
      <p class="docs-eyebrow">See it on a real system</p>
      <h2 class="show-head y2k-head" id="demo-title">Twenty services, mapped from code and traces</h2>
      <p>This is the OpenTelemetry project's demo application, an open-source online shop. Its map goes from nine boxes anyone can follow down to the function that charges the card, and every service shows the traffic its traces recorded.</p>
      <p>Open it here, or run it on your own machine in five commands. There is a second live map too: <a href="/map" data-testid="home-demo-own">fraktul itself, mapped with fraktul</a>, with narrated tours.</p>
      <div class="docs-hero-ctas"><a class="pill main" href="/shop/" data-testid="home-demo-open">Open the shop's map</a><a class="pill" href="/demo" data-testid="home-demo-page">About the demo</a></div>
    </div>
    <div class="show-screen y2k-screen">${shot("traces", "(max-width: 900px) 92vw, 700px")}</div>
  </div>`;
}
