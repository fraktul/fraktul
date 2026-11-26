---
title: The model file
summary: Every field of model.yaml, and what fraktul does with it.
---
The model is one YAML file in the project it describes, usually `docs/arch/model.yaml`. Paths in it are relative to the
project root: the git checkout that holds the model, or `project_root` if you set it.

## Top level

```yaml
version: 1
title: Shop system map          # the page title
brand: Shop                     # the name in the top bar
root: shop                      # the block the map opens on
default_repo: main              # anchors that name no repo use this one
adrs_dir: docs/adr              # decision records (optional)
live_module: live.ts            # facts read at build time (optional)
voice: { voice: bf_emma, speed: 1 }
expect: { tours: 3, depth: { api: 3, "*": 2 } }
```

`expect` is a promise the check holds you to: at least that many tours, and blocks that drill at least that deep.

## Repos

```yaml
repos:
  main: { path: ".", github: you/shop }
  billing: { path: "~/github/billing", github: you/billing }
  notes: { path: "~/notes", private: true, include: ["scripts/*.py"] }
```

A system usually spans several repos. Anchors name them as `billing:src/invoice.ts`. A repo that isn't checked out (on
CI, say) is skipped and named in the check's output. `private: true` shows file names only, never their contents, and
`include` limits which files are read.

## Blocks

```yaml
nodes:
  api:
    title: API
    kind: component        # district, component, module, data, person, service, repo, doc, step
    status: built          # built, prototype, planned, proposed, external
    summary: One paragraph in plain words.
    live: [run]            # live fact blocks to show
    anchors:
      files: [src/api/orders.ts]
      functions: ["src/api/orders.ts#createOrder"]
      data: [schema/orders.sql]
      docs: [docs/api.md]
      adrs: ["0004"]
    diagram: |
      flowchart LR
        validate --> charge --> store
```

The id is also the box's id in every diagram, so use lowercase letters, digits and underscores. Planned blocks are
drawn dashed. Anchors are what the check verifies and what the side panel links to.

## Coverage

```yaml
coverage:
  - repo: main
    include: ["src/**/*.ts"]
    exclude: ["**/*.test.ts"]
```

The check lists every matching file the model doesn't mention yet. With `--strict` it fails until they are all placed,
so new modules can't quietly stay off the map.
