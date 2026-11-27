# fraktul

Maps of software you can dive into. One model file describes a system as blocks and how they connect. fraktul checks
it against the code, reads the files, functions and calls below each block from the code itself, and builds one page
where you click from the whole system down to a line of source, follow tours, listen to narrated walkthroughs, and
record your own.

**[fraktul.dev](https://fraktul.dev)** · [Features](https://fraktul.dev/features) ·
[Docs](https://fraktul.dev/docs) · [The live map](https://fraktul.dev/map) (fraktul, mapped with fraktul) ·
[The demo shop](https://fraktul.dev/shop/) (twenty services, mapped from code and traces)

## Why

Understanding a system is now the slow part of building software: taking over a project, teaching a design to a team,
learning someone else's service before building beside it, and keeping up with code that AI writes faster than anyone
reads it. Diagrams drawn by hand go stale, and reading the code shows every detail but not how the pieces fit.
fraktul keeps both in one place: a person draws the top, the code fills in everything below, and a check fails the
build when the two stop agreeing.

## Install

```bash
npm install --save-dev fraktul
```

Node 24.21 or newer, and a project in git (fraktul reads only files git tracks). Narrated tours also need an Apple
silicon Mac with [uv](https://docs.astral.sh/uv/) and ffmpeg.

```bash
npx fraktul skill      # install the agent skill: then ask your AI assistant to "map this system with fraktul"
npx fraktul init       # or start by hand: a starter model at docs/arch/model.yaml, from your project's folders
npx fraktul check      # every file, function, diagram box and tour step it names must exist
npx fraktul dev        # the live map at http://localhost:8080
npx fraktul build      # a static folder (fraktul-dist/) for any host
npx fraktul voice      # speak the tours (local; the first run sets up the voice engine)
npx fraktul traces http://jaeger:16686   # what OpenTelemetry traces saw, for the map and the check
```

Every command takes the model's path; without one, fraktul looks for `./model.yaml`, then `./docs/arch/model.yaml`.
The full guide is at [fraktul.dev/docs](https://fraktul.dev/docs/getting-started).

The map is a static page. Mermaid, three.js and its fonts ship with fraktul and are served beside it, so it loads
nothing from a CDN and nothing about your code leaves your machine.

## Written by your AI assistant

The model is a text file with a check that says when it is wrong, so an AI coding assistant can write it. `fraktul
skill` (and `fraktul init`) install an agent skill into `.claude/skills` and `.agents/skills` that teaches the
assistant the levels, the conventions and the check loop. Then ask it to map the system. Details:
[Map it with AI](https://fraktul.dev/docs/ai). The skill's source is `skills/fraktul/SKILL.md`.

## Levels

One map holds every altitude: the **system** from 30,000 feet, each **service**, each **feature**, then the files and
functions fraktul reads from the code. `kind: system | service | feature` says which level a block is.
[Levels](https://fraktul.dev/docs/levels).

## Traces

`fraktul traces <jaeger url | OTLP JSON file or folder>` boils OpenTelemetry traces down to `traces.json` beside the
model: services, the calls between them, error counts and latency (no payloads). Give each block `service: <name>`
and its panel shows the real traffic; `fraktul check` lists calls the traces show that no diagram draws, and
`--strict` fails on them. [Traces](https://fraktul.dev/docs/traces). `example/shop/` is the OpenTelemetry Demo mapped
this way.

## The model

```yaml
version: 1
title: Shop system map                # page title
brand: Shop system map                # top-left name
root: city                            # the node the map opens on
default_repo: main                    # anchors without a repo prefix
adrs_dir: docs/adr                    # NNNN-title.md files with a "- Status:" line (optional)
live_module: live.ts                  # facts read at build time (optional, see below)
voice: { voice: bf_emma, speed: 1, say_as: { NCCI: "N C C I" } }
expect: { tours: 3, depth: { answer_core: 3, "*": 2 } }    # requirements the check enforces (optional)

repos:
  main: { path: "." }                                       # source links from the checkout's git origin
  other: { path: "~/github/other", github: owner/other }    # skipped when not checked out (CI)
  billing: { path: "~/src/billing", remote: "https://gitlab.com/acme/billing", remote_private: true }
  local: { path: "~/notes", private: true, include: ["scripts/*.py"] }   # names only, never contents

coverage:                             # files the check expects the model to mention
  - repo: main
    include: ["src/**/*.ts"]
    exclude: ["**/*.test.ts"]

nodes:
  calculator:                         # the id is also the Mermaid box id: lowercase, digits, _
    title: Unit calculator
    kind: component                   # district · component · module · data · person · service · repo · doc · step
    status: prototype                 # built · prototype · planned · proposed · external
    summary: One paragraph in plain words.
    live: [run]                       # live fact blocks to show
    anchors:
      files: [eval/calc.ts]
      functions: ["eval/calc.ts#fractionBlocks"]
      data: [tables/planning.json]
      docs: [eval/README.md]
      adrs: ["0009"]
      repo: main                      # default repo for these paths; `other:path` names another
    diagram: |                        # plain Mermaid flowchart
      flowchart LR
        read["Read facts"]:::model --> blocks["Blocks of 5"]
```

### How diagrams chain

- **A box whose id is another node's id is that block**: it gets a badge, a hover peek, and opens on click. Its label
  can be left out; it shows the block's title.
- **`block/inner`** in an edge points at a box inside another block: the inner box when that block is drawn expanded,
  the block itself otherwise.
- **`%% @link box anchor`** makes a plain box open a file, a function (`path#name`) or an ADR (`adr:0012`).
- **`%% @expand box`** draws that block's diagram inside this one as a subgraph: building a bigger diagram out of
  blocks.
- A node with anchors but no diagram gets a generated diagram of its files and functions. Every file shows its
  functions and who calls whom; every function shows callers, callees and source with clickable calls.
- Classes: `model`, `code`, `human`, `data`, `ext`. Planned blocks are drawn dashed.

Only git-tracked files are read, so ignored, licensed or local data never enters the page.

### Source links

Local paths are only used while building. The page links every file, function and ADR to its source on the repo's
host instead, pinned to the commit that was read, so a deployed map keeps pointing at the code it was built from.

- **Where the repo lives**: `remote:` (any clone or web URL), or `github: owner/repo` as shorthand. With neither,
  fraktul reads the checkout's `git remote get-url origin`. A repo with no remote simply has no links.
- **Hosts**: GitHub, GitLab, Bitbucket, Azure DevOps and Gitea/Forgejo (Codeberg), each in its own line-link format.
  A self-hosted server whose name does not say what it runs needs `remote_kind: gitlab` (or `github`, `bitbucket`,
  `azure`, `gitea`); the check fails on a stated remote it cannot link to.
- **Credentials**: a username, password or token in a URL (common in `origin`) is dropped and never printed.
- **Private repos**: `remote_private: true` marks the links with a lock, so readers without access know why the host
  asks them to sign in. This is separate from `private: true`, which keeps a repo's contents out of the page.
- A repo that is not checked out links to its default branch, since there is no commit to pin to.

### Big files

A file with more than 20 functions is drawn as named groups (its own section headings when it has them, the call flow
when it does not), with one line between two groups and no lines to helpers used all over the file. Open a group to
see its functions. Details: [Diagrams](https://fraktul.dev/docs/diagrams#big-files-stay-readable).

### Links

The address always says where you are, so any view can be shared:
`#check` (a level), `#check/refs` (a box on it), `#fraktul?tour=how-it-works&step=2` (a tour stop),
`#check?view=3d` (3D, from the ground), `#check?view=3d&cam=bird` (3D, from above). The flat map is the default.

### The 3D view

**3D** (or the <kbd>3</kbd> key) shows the level on screen as a place you can walk through: the same boxes and arrows,
standing where Mermaid drew them. You start on the ground with every block in view; **Bird's eye** (<kbd>B</kbd>)
starts from above instead. Drag to look, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move,
<kbd>Q</kbd>/<kbd>E</kbd> down and up, click a block to go inside, <kbd>Esc</kbd> to come back out. Shape follows what
a block is (towers, data disks, people, clouds), height follows lines of code, planned blocks are holograms, and each
block's details come from a hash of its id, so it keeps its silhouette when the code changes. three.js ships with
fraktul and loads the first time 3D is switched on. The design is in `docs/3d-view.md`.

### Tours, narration and recordings

```yaml
tours:
  - id: one-question
    title: Follow one coder's question
    summary: One line for the tour list.
    voice: { voice: am_michael }      # optional, per tour
    steps:
      - id: q-sort                    # optional; needed when something jumps here
        view: sort                    # whose diagram is shown
        expand: [sort_guards]         # optional
        focus: [reader_1, reader_2]   # highlighted boxes
        title: Two models sort it
        text: Short text on the tour card.
        say: >-                       # narration: say more than the card shows
          Sorting means one decision. [[reader_1, reader_2]] Two models sort it on their own.
          [[sort_guards]] Code guards check the known traps.
        next: q-read                  # default: the next step
        branches: [{ label: "Units over a course", to: q-calc }]   # step id or tour:<id>
```

- `[[box, other]]` in `say:` moves the highlight at that point of the narration. The check validates every cue.
- `fraktul voice` speaks each step with Kokoro (82M) on Apple silicon through mlx-audio, one sentence at a time, so
  captions and cues are timed exactly. Audio goes to `<model dir>/.fraktul/voice/` (keep it out of git: it is rebuilt
  from the text). Codes like 77427 are read digit by digit; `say_as` fixes other words. Voices: `af_heart`,
  `am_michael`, `bf_emma`, `am_fenrir` and the rest of Kokoro's list.
- In the map, **Listen** plays a tour: captions follow, the highlight moves with the cues, and the tour moves on by
  itself (pausing at branches).
- **Record a walkthrough** (Tours → Record) captures your microphone and every view you open, box you hover and box
  you click. Save downloads one file; `fraktul import-recording <file>` puts it in `<model dir>/recordings/` (commit
  it), and the next build lists it under the tours.

### Live facts

`live_module` is a TypeScript file next to the model whose default export returns named blocks; a node shows them with
`live: [name]`. The ADR list is built in (`live: [adrs]`).

```ts
export default function (ctx) {          // ctx: { project, modelDir, repoRoot(repo), adrs }
  return { run: { title: "Latest run", bar: [{ label: "right", value: 631, tone: "good" }], rows: [["Right", 631]], source: "results/v8.json" } };
}
```

Blocks can carry `rows`, `bar` (tones good, warn, bad, neutral), `list` (items with `key` open things), `groups`,
`text`, `source`, and `fold` to fold a long list.

## Design system

Two styles share one token structure (`src/pages/css/tokens.css`), each in light and dark:
**flat**, the default (a quiet modern UI: flat neutral surfaces, one blue accent, Inter), and **y2k**, opt-in (a
liquid-chrome nav, wide Michroma titles, a holographic foil logo, brushed-metal diagram boxes, modern glass controls). Components read only tokens. Rules:
body text sits on a flat surface; gradients are for bars, buttons, the logo and the tour strip; every text colour meets
WCAG AA. The reference page is internal: `npm run site:dev`, then /design (also on pull request previews; production leaves it out).

## Logo

Dive, golden: a frame with a smaller frame and a solid square tucked into its corner, sized by the golden
ratio, in a pastel iridescent foil (`--mark-shape` and `--foil` in tokens.css).

## fraktul.dev

`npm run site:dev` serves the home page, the features page, the documentation (`content/docs/*.md`), the design system
and fraktul's own map; `npm run site:build` writes `site-dist/`. The site's screenshots of the map and its social card
are committed (`npm run site:shots -- <url of a running build>`, `npm run site:images`). Every branch deploys a preview and `main` deploys production on
Cloudflare: see [DEPLOYMENT.md](DEPLOYMENT.md). Tags `v*.*.*` publish to npm: see [RELEASING.md](RELEASING.md).

## Develop

fraktul is TypeScript run by Node's own type stripping; the npm package is a JavaScript build of it
(`npm run package`), because Node does not strip types inside `node_modules`.

```bash
npm ci
npm test            # parser, code reader, grouping, init, the example model, and a broken model the check must catch
npm run dev         # fraktul's own map (example/model.yaml)
npm run site:dev    # fraktul.dev
npm run package     # the npm package, in package/
```

Bascik's agent skills are in `.claude/skills` and `.agents/skills` (see `AGENTS.md`).

## License

MIT
