---
title: Getting started
summary: Map a project in three commands, then keep the map honest with one check.
---
fraktul draws a map of a software system from one model file and the code itself. You describe the big blocks and how
they connect; fraktul reads the files and functions below them, checks every reference, and serves a page you can click
down through, all the way to the source.

## What you need

- Node 24.21 or newer.
- A git checkout of the project you want to map. fraktul only reads git-tracked files, so anything ignored, licensed or
  local never ends up in the map.
- For narrated tours: an Apple silicon Mac. The voice runs locally; nothing is sent anywhere.

## Three commands

```bash
git clone git@github.com:rinsesoft/fraktul.git ~/github/fraktul
cd your-project
node ~/github/fraktul/bin/fraktul.ts check docs/arch/model.yaml
node ~/github/fraktul/bin/fraktul.ts dev docs/arch/model.yaml
```

`check` fails when the model points at something that no longer exists. `dev` serves the map at
`http://localhost:8080` and rebuilds it when the model or the code changes. fraktul installs its own two dependencies the
first time it runs.

fraktul runs from a checkout rather than as an npm package because Node does not strip TypeScript inside
`node_modules`. Point `FRAKTUL_HOME` at another checkout if you keep it somewhere else.

## A first model

Start with one block that names the whole system and draws its parts:

```yaml
version: 1
title: Shop
root: shop
repos:
  main: { path: ".", github: you/shop }
nodes:
  shop:
    title: Shop
    summary: Customers browse, pay and get their order.
    diagram: |
      flowchart LR
        web["Web app"] --> api["API"] --> db[("Orders")]
  api:
    title: API
    status: built
    anchors:
      files: [src/api/orders.ts, src/api/payments.ts]
```

`api` is a block, so its box opens. It has files but no diagram of its own, so fraktul generates one: its files, their
functions, and who calls whom. `web` and `db` are plain boxes until you give them a node.

## Next

- [The model file](/docs/model) covers every field.
- [Diagrams that chain](/docs/diagrams) explains how boxes become doors.
- [Tours and narration](/docs/tours) shows how to walk someone through the system.
