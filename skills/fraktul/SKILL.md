---
name: fraktul
description: Map a software system with fraktul - write or update the model file (docs/arch/model.yaml) that fraktul turns into a clickable map from the whole system down to the source. Use when asked to map, diagram or document an architecture or codebase; to explain how a system, service or feature works; to prepare a handover, onboarding or knowledge-transfer walkthrough; to write or narrate a tour; when `fraktul check` fails or lists unmapped files, undrawn calls or unmapped services; when code was added, moved or renamed and the map must follow; or when adding OpenTelemetry traces to the map.
license: MIT
metadata:
  author: Rinsesoft
  homepage: https://fraktul.dev
---

# Mapping a system with fraktul

fraktul draws a map of a software system that people click through, from the whole system down to a line of source.
You write the top of it: one YAML file of blocks, each with a summary and a plain Mermaid diagram. fraktul reads
everything below (files, functions, who calls whom, source) from the code, and `fraktul check` fails when the file
names something that is not there. Your job is the part code cannot say: what the parts are, why they exist, and
how they connect.

Docs: https://fraktul.dev/docs. Every field: https://fraktul.dev/docs/model.

## The loop

Run fraktul with `npx fraktul <command>` (it is a dev dependency; `npm install --save-dev fraktul` if it is missing).

1. `npx fraktul init` when there is no model yet. It writes `docs/arch/model.yaml` from the project's folders: a
   starting point that already passes the check. Without a path, every command uses `./model.yaml`, then
   `./docs/arch/model.yaml`.
2. **Read before you write.** Read the README, the entry points, the routes, the deploy files (compose, Helm,
   Terraform), and the main modules. Find what a newcomer needs first: who uses the system, what it is for, the
   three to seven big parts, and the path one request takes.
3. Write the levels, top down (below). Replace every `TODO` the starter left.
4. `npx fraktul check`. Fix every broken reference it names. Repeat until it prints `All references resolve.`
5. `npx fraktul check --strict` lists files the model does not mention. Mention the ones that matter (add them to
   a block's `anchors.files`); narrow `coverage:` for the ones that do not (generated code, tests, vendored files).
6. Write at least one tour (below): the path a newcomer should walk first.
7. Tell the person to run `npx fraktul dev` and open http://localhost:8080. Do not start a long-running server
   yourself unless asked.

Never invent a file, function or decision record. An anchor must be a real, git-tracked path: fraktul reads only
files git tracks, so `git add` a new file before checking.

## The levels

A map has as many levels as the system needs. Name each block's level with `kind`:

| Level | `kind` | What it is | What its diagram shows |
|---|---|---|---|
| System | `system` | The whole thing, from 30,000 feet. The root. A company with several systems has one per system under a root. | People, the services (or big parts), outside systems, data stores |
| Service | `service` | Something deployed and running: an API, a worker, a web app | Its features or main parts, and what it talks to |
| Feature | `feature` | Something the product does: "checkout", "search", "password reset". Often crosses services. | The steps of the feature, in order, as a flow |
| Code | (none) | Files and functions | Nothing to draw: fraktul generates these levels from `anchors` |

Other kinds say what a box stands for: `component`, `module`, `data`, `person`, `repo`, `doc`, `step`.

Rules that make a map readable:

- **Five to nine boxes per diagram.** More than that, group some into a block and give it its own diagram.
- **One sentence a non-engineer understands** in every `summary`. Say what the part is for, not how it is built.
  "Takes the customer's card and asks the bank for the money", not "Wraps the Stripe SDK".
- **A box whose id is another node is a door.** Reuse the node id as the Mermaid box id; do not label it (the
  node's title is used).
- **Draw the flow, not the folder tree.** Arrows mean "calls", "sends", "reads from". Label an arrow when the
  label says something ("order placed", "over gRPC").
- **Stop the hand-written levels where the code can take over.** A block with `anchors.files` and no `diagram`
  gets generated file and function levels. Do not draw functions by hand.
- A small monolith needs two levels (system, then features). A platform of services needs three or four.

## The model file

```yaml
version: 1
title: Shop system map
root: shop                       # the node the map opens on
repos:
  main: { path: "." }            # more repos: other: { path: "../other", github: owner/other }
coverage:                        # files `check --strict` expects the model to mention
  - repo: main
    include: ["src/**/*.ts"]
    exclude: ["**/*.test.ts"]

nodes:
  shop:                          # id: lowercase letters, digits, _  (it is also the Mermaid box id)
    title: Shop
    kind: system
    summary: Customers browse products, pay, and get their order delivered.
    diagram: |
      flowchart LR
        customer(["A customer"]):::human --> web
        web --> checkout --> payments
        checkout --> orders_db[("Orders")]:::data
        payments --> bank(["The bank"]):::ext
  checkout:
    title: Checkout
    kind: service
    status: built                # built | prototype | planned | proposed | external
    service: checkoutservice     # its name in traces (OpenTelemetry service.name), if any
    summary: Turns a cart into a paid order.
    diagram: |
      flowchart LR
        cart["Read the cart"] --> price["Work out the total"] --> pay["Ask payments for the money"] --> save["Save the order"]
        %% @link price src/checkout/pricing.ts#total
        %% @link save src/checkout/orders.ts
    anchors:
      files: [src/checkout/index.ts, src/checkout/pricing.ts]
      functions: ["src/checkout/pricing.ts#total"]
      adrs: ["0007"]             # needs adrs_dir: docs/adr at the top of the file
```

Diagram conventions (plain Mermaid otherwise):

- Box id = node id: the box opens that node.
- `%% @link <box> <path>` or `<path>#<function>` or `adr:0007`: a plain box opens that code or decision.
- `%% @expand <box>`: draw that block's own diagram inside this one.
- `block/inner` in an arrow: point at a box inside another block.
- Classes: `:::human` (a person), `:::data` (a store), `:::ext` (outside the system), `:::model` (an AI model),
  `:::code`. Planned blocks are drawn dashed by their `status`.
- Paths are relative to the project root (the git checkout holding the model). Another repo: `other:path/file.ts`.

## Tours

A tour is how a person learns the system without you in the room. Write the one a new teammate needs first.

```yaml
tours:
  - id: place-an-order
    title: Follow one order
    summary: From the customer's click to the money arriving.
    steps:
      - view: shop                 # whose diagram is on screen (a node with a diagram)
        focus: [web, checkout]     # boxes in that diagram to light up
        title: It starts in the browser
        text: The web app sends the cart to checkout.
        say: >-                    # optional narration; say more than the card shows
          Everything starts in the browser. [[web]] The web app holds the cart,
          [[checkout]] and hands it to checkout when the customer pays.
```

- Five to nine steps. One idea per step. `text` is one or two sentences; `say` can be four or five.
- Start at the top level, go down into the part that matters, come back up.
- `[[box]]` in `say` moves the highlight at that word. Every cue and every `focus` must be a box in that step's
  `view`; the check fails otherwise.
- Write for someone who does not know the code. Explain a term the first time it appears.
- `npx fraktul voice` speaks `say:` with a local neural voice (Apple silicon only). Do not run it unless asked.

## Keeping the map true

A map is only worth having while it is right. When you change code in a project that has a model:

- **Same change, same pull request.** Moved or renamed a file or function the model names: fix the anchor. Added a
  module: add it to a block, or add a block. Changed how two parts talk: redraw the arrow.
- Run `npx fraktul check` before you finish. A failing check is a real bug in the map, never something to silence.
- If a tour step's box is gone, rewrite the step, do not delete the tour.
- Do not paste numbers into summaries (counts, versions, dates): they go stale. Use `live:` facts for those
  (https://fraktul.dev/docs/live-facts).

## What the running system says (OpenTelemetry)

Code shows what a service contains. Traces show which services really talk to each other.

```bash
npx fraktul traces http://localhost:16686            # a Jaeger address
npx fraktul traces ./otel-export/                    # OTLP JSON from the Collector's file exporter
npx fraktul traces ./otel-export/ --mermaid          # print the observed service graph as a first diagram
```

It writes `traces.json` beside the model: service names, calls between them, error counts and latency. No
payloads and no attribute values. Commit it.

- Give each service block `service: <name>` with the exact name from the traces.
- `fraktul check` then lists calls the traces show that no diagram draws, and services nobody mapped. Draw the
  missing arrows or map the services; `--strict` fails until you do.
- A database or queue shows up under its system name (`postgresql`, `kafka`, `redis`); map it with `service:` too.
- "Unseen" arrows (drawn, never traced) are worth a second look, but a short capture misses rare calls.

## Commands

| Command | Does |
|---|---|
| `fraktul init [model]` | A starter model from the project's folders |
| `fraktul check [model] [--strict] [--json]` | Every reference must exist; `--strict` also fails on unmapped files, calls and services |
| `fraktul dev [model] [--port 8080]` | The live map, rebuilt as the model or code changes |
| `fraktul build [model] [--out dir]` | A static folder for any host. `FRAKTUL_PUBLIC=1` leaves the source out |
| `fraktul traces <source>... [--model path] [--mermaid]` | Traces into `traces.json` |
| `fraktul voice [model]` | Speak the tours' narration (Apple silicon) |
| `fraktul skill` | Install or update this skill in a project |

`fraktul check --json` prints `errors`, `unmentioned`, `traces`, `skipped`, `unreachable` and `stats` for you to
read instead of the text report.

## When you are done

Report what you mapped in a few lines: the levels, the number of blocks, the tours, what the check says, and what
you were not sure about (a part you could not read, an arrow you guessed). Guesses belong in the report, not hidden
in the model.
