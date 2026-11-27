---
title: The model file
summary: Every field of model.yaml, with an example of each part.
section: Concepts
---
The model is one YAML file in the project it describes, usually `docs/arch/model.yaml`. Paths in it are relative to
the project root: the git checkout that holds the model, or `project_root` if you set it.

## A complete example

```yaml
version: 1
title: Shop system map              # the page title
brand: Shop                         # the name in the top bar (default: title)
root: shop                          # the block the fraktul opens on
default_repo: main                  # anchors that name no repo use this one
adrs_dir: docs/adr                  # decision records (optional)
live_module: live.ts                # facts read at build time (optional)
voice: { voice: bf_emma, speed: 1, say_as: { SKU: "S K U" } }
expect: { tours: 1, depth: { "*": 1 } }

repos:
  main: { path: ".", github: you/shop }
  billing: { path: "~/github/billing", remote: "https://gitlab.com/you/billing" }

coverage:
  - repo: main
    include: ["src/**/*.ts"]
    exclude: ["**/*.test.ts"]

nodes:
  shop:
    title: Shop
    kind: district
    summary: Customers browse, pay and get their order.
    diagram: |
      flowchart LR
        web["Web app"] --> api --> invoices

  api:
    title: API
    kind: component
    status: built
    summary: Takes orders and payments.
    anchors:
      files: [src/api/orders.ts]
      functions: ["src/api/payments.ts#charge"]

  invoices:
    title: Invoices
    kind: component
    status: planned
    summary: Turns finished orders into invoices.
    anchors:
      repo: billing
      files: [src/invoice.ts]

tours:
  - id: one-order
    title: Follow one order
    summary: From the cart to the invoice.
    steps:
      - view: shop
        focus: [web, api]
        title: The customer checks out
        text: The web app sends the cart to the API.
```

## Top-level fields

| Field | Required | What it does |
|---|---|---|
| `version` | yes | Always `1`. |
| `root` | yes | Id of the block the fraktul opens on. |
| `repos` | yes | Where the code lives. See [Repos](#repos). |
| `nodes` | yes | The blocks. See [Blocks](#blocks). |
| `title` | no | Page title. Default: `System map`. |
| `brand` | no | Name in the top bar. Default: the title. |
| `project_root` | no | Project root, relative to the model file. Default: the git checkout that holds the model. |
| `default_repo` | no | Repo for anchors that name none. Default: the repo whose `path` is `"."`, else `main`. |
| `adrs_dir` | no | Folder of decision records. See [Live facts](/docs/live-facts). |
| `live_module` | no | A TypeScript file, relative to the model, that returns live facts. |
| `traces` | no | The summary `fraktul traces` wrote, relative to the model. Default: `traces.json` beside the model, when there is one. See [Traces](/docs/traces). |
| `voice` | no | Narration settings. See [Tours and narration](/docs/tours). |
| `expect` | no | Promises the check enforces. See [Expectations](#expectations). |
| `coverage` | no | Files the check expects the model to mention. See [Coverage](#coverage). |
| `tours` | no | Guided paths through the fraktul. See [Tours and narration](/docs/tours). |

## Repos

A system often spans several repos. Each entry gives a repo a short key that anchors use as a prefix:
`billing:src/invoice.ts`.

```yaml
repos:
  main: { path: ".", github: you/shop }
  billing: { path: "~/github/billing", remote: "https://gitlab.com/you/billing" }
  infra: { path: "~/src/infra", remote: "https://git.example.com/ops/infra", remote_kind: gitlab, remote_private: true }
  notes: { path: "~/notes", private: true, include: ["scripts/*.py"] }
```

| Field | What it does |
|---|---|
| `path` | Where the checkout is. Relative to the project root, or starting with `~/`. |
| `title` | Display name. Default: the key. |
| `github` | Shorthand for `remote: https://github.com/<owner/repo>`. |
| `remote` | The repo's clone or web URL, on any host. Default: the checkout's `origin`. |
| `remote_kind` | `github`, `gitlab`, `bitbucket`, `azure` or `gitea`, for a self-hosted server whose name doesn't say. |
| `remote_private` | Marks source links with a lock, so readers know the host will ask them to sign in. |
| `private` | Show file names only, never their contents. |
| `include` | Globs that limit which files fraktul reads. |

A repo that isn't checked out (on CI, say) is skipped and named in the check's output. Set
`FRAKTUL_REPO_<KEY>=/some/path` to point a repo somewhere else for one run, for example `FRAKTUL_REPO_BILLING`.

### Source links

Every file, function and decision record in the fraktul links to its source on the repo's host, pinned to the commit that
was read, so a deployed fraktul keeps pointing at the code it was built from. GitHub, GitLab, Bitbucket, Azure DevOps and
Gitea or Forgejo (including Codeberg) are supported. A username, password or token in a remote URL is dropped and
never printed. A repo with no remote has no source links. A repo that isn't checked out links to its default branch.

## Blocks

```yaml
nodes:
  api:
    title: API
    kind: component
    status: built
    summary: One paragraph in plain words.
    live: [run]
    anchors:
      repo: main
      files: [src/api/orders.ts]
      functions: ["src/api/orders.ts#createOrder"]
      data: [schema/orders.sql]
      docs: [docs/api.md]
      adrs: ["0004"]
    diagram: |
      flowchart LR
        validate --> charge --> store
```

| Field | What it does |
|---|---|
| `title` | Required. Shown on the box when the box has no label, and in the panel. |
| `kind` | The level: `system`, `service` or `feature` (see [Levels](/docs/levels)). Or what the box stands for: `component`, `module`, `data`, `person`, `repo`, `doc`, `step`. `district` is an older word for `system`. The check rejects anything else. |
| `status` | `built`, `prototype`, `planned`, `proposed` or `external`. Planned blocks are drawn dashed. |
| `summary` | One paragraph, shown in the panel and the hover peek. |
| `diagram` | A Mermaid flowchart. See [Diagrams that chain](/docs/diagrams). |
| `anchors` | The code behind the block (below). |
| `service` | The block's name in traces (OpenTelemetry's `service.name`), or a list of names. See [Traces](/docs/traces). |
| `live` | Names of live fact blocks to show in the panel. See [Live facts](/docs/live-facts). |

The id is also the box's id in every diagram, so it must be lowercase letters, digits and underscores, starting with
a letter: `billing_api`, not `billing-api`.

### Anchors

| Field | Holds |
|---|---|
| `files` | Source files. Each one becomes a level of its own. |
| `functions` | `path#name`. Must name a function the code reader finds in that file. |
| `data` | Data files, schemas, fixtures. |
| `docs` | Documentation files. |
| `adrs` | Decision record numbers, as strings: `"0004"`. |
| `repo` | Default repo for this block's paths. |

Any path can name another repo with a prefix: `billing:src/invoice.ts`.

fraktul reads functions, imports and calls from TypeScript and JavaScript (`.ts`, `.mts`, `.js`, `.mjs`) and Python
(`.py`). Other files are anchored and checked like any file, and the panel shows their first lines.

## Coverage

```yaml
coverage:
  - repo: main
    include: ["src/**/*.ts"]
    exclude: ["**/*.test.ts"]
```

The check lists every matching file the model doesn't mention yet. With `--strict` it fails until they are all
placed, so new modules can't stay off the fraktul unnoticed.

## Expectations

```yaml
expect:
  tours: 2
  depth: { api: 3, "*": 2 }
```

`expect` is a promise the check holds you to. `tours` is the least number of tours. `depth` is how many levels each
block in the root diagram must drill down through model diagrams (`"*"` for the ones not named). A block with code
anchors and no diagram counts as one level.
