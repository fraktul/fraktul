# fraktul

Maps of software you can dive into. One model file describes a system as blocks and how they connect; fraktul checks it
against the code, generates the file and function levels from the code itself, and serves one page where you click
down from the whole system to a line of source, follow tours, listen to narrated walkthroughs, and record your own.

fraktul.dev (coming). Built with [Bascik](https://bascik.dev).

## Use it on a project

Keep the model in your project (for example `docs/arch/model.yaml`) and a fraktul checkout next to it:

```bash
git clone git@github.com:rinsesoft/fraktul.git ~/github/fraktul
cd your-project
node ~/github/fraktul/bin/fraktul.ts check docs/arch/model.yaml    # every anchor, box, cue and step must exist
node ~/github/fraktul/bin/fraktul.ts dev   docs/arch/model.yaml    # the live map at http://localhost:8080
node ~/github/fraktul/bin/fraktul.ts build docs/arch/model.yaml --out fraktul-dist
node ~/github/fraktul/bin/fraktul.ts artifact docs/arch/model.yaml # page without <html>/<head>, for a claude.ai Artifact
node ~/github/fraktul/bin/fraktul.ts voice docs/arch/model.yaml    # speak the tours (local, first run sets up the engine)
```

Node 24.21+. fraktul installs its own two dependencies (`@bascik/bascik`, `yaml`) on first run. It runs as a checkout
rather than an npm package because Node does not strip TypeScript inside `node_modules`.

The example in `example/model.yaml` is fraktul's own map: `npm run dev` here shows it.

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
  main: { path: ".", github: owner/repo }
  other: { path: "~/github/other", github: owner/other }    # skipped when not checked out (CI)
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
**chrome** (Y2K liquid chrome: mirror-silver bars and buttons, wide Michroma titles, a holographic foil logo) and
**minimal** (a quiet modern UI: flat neutral surfaces, one blue accent, Inter). Components read only tokens. Rules:
body text sits on a flat surface; gradients are for bars, buttons, the logo and the tour strip; every text colour meets
WCAG AA. The live reference is the design page of fraktul.dev (`npm run site:dev`, then /design).

## fraktul.dev

`npm run site:dev` serves the home page, the design system and fraktul's own map; `npm run site:build` writes
`site-dist/`.

## Develop

```bash
npm test            # parser, code reader, the example model, and a broken model the check must catch
npm run dev         # fraktul's own map
```
