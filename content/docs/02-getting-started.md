---
title: Quickstart
summary: Install fraktul from npm, write a first model, check it, and open the map.
section: Start
---
This page takes you from nothing to a map of your own project. You need about ten minutes and a project in a git
repository.

## Requirements

- **Node 24.21 or newer.** fraktul is written in TypeScript and runs on Node's own type stripping.
- **A git checkout** of the project you want to map. fraktul reads only files git tracks.
- **For narrated tours only:** a Mac with Apple silicon, plus [uv](https://docs.astral.sh/uv/) and ffmpeg. Everything
  else works on any system.

## 1. Install fraktul

Add fraktul to the project you want to map, as a dev dependency:

```bash
npm install --save-dev fraktul
```

Every example in these docs writes `fraktul <command>`. In a project that installed it, that is
`npx fraktul <command>`, or plain `fraktul <command>` inside a `package.json` script.

> [!TIP]
> Have an AI coding assistant? It can do steps 2 and 3 for you. Run `npx fraktul skill`, then ask it to "map this
> system with fraktul". See [Map it with AI](/docs/ai).

> [!TIP]
> No `package.json` in the project? `npx fraktul@latest <command>` runs it without installing anything into the
> project, and `npm install --global fraktul` puts `fraktul` on your path.

## 2. Write a first model

The fast way is to let fraktul write a starting point from your project's folders:

```bash
fraktul init
```

It writes `docs/arch/model.yaml` with one block per big folder, the files in each, one diagram that shows the blocks,
and a short tour. It also installs the [agent skill](/docs/ai), so an assistant can take it from there. It passes the check as it is. Your part is what code can't say: replace each `TODO` with a plain
sentence, and draw the arrows between the boxes.

Or write the model by hand. Create `docs/arch/model.yaml` in your project. fraktul looks for `./model.yaml` and then `./docs/arch/model.yaml`, so
with either location you can leave the path off every command.

```yaml
version: 1
title: Shop system map
root: shop
repos:
  main: { path: "." }
nodes:
  shop:
    title: Shop
    kind: district
    summary: Customers browse, pay and get their order.
    diagram: |
      flowchart LR
        web["Web app"] --> api --> db[("Orders")]
  api:
    title: API
    kind: component
    status: built
    summary: Takes orders and payments.
    anchors:
      files: [src/api/orders.ts, src/api/payments.ts]
```

Change the two file paths to real files in your project. Here is what this model says:

- The map opens on `shop`, whose diagram has three boxes.
- `api` is the id of another block, so its box becomes a door: click it to go inside.
- `api` names files but has no diagram of its own, so fraktul draws one from the code: the files, their functions and
  who calls whom. Click a file to see its functions, and a function to read its source.
- `web` and `db` are plain boxes until you give them blocks of their own.

## 3. Check it

```bash
fraktul check
```

The check prints what it found and ends with `All references resolve.` If a path is wrong, it says which one and exits
with an error:

```text
1 broken reference:
  ✗ node api: file src/api/orders.ts is not in the repo (moved, renamed, deleted, or not tracked by git)
```

> [!TIP]
> A file you just created is not tracked yet. `git add` it, and the check finds it.

## 4. Open the map

```bash
fraktul dev
```

Open [http://localhost:8080](http://localhost:8080). The map rebuilds when you save the model. Use `--port 3000`
to pick another port.

In the map:

- **Click** a box with a badge to go inside. **Esc** or **Backspace** goes back up.
- **Hover** a box to peek at what's inside.
- **/** jumps to search. **0** fits the diagram to the screen. **3** switches to the 3D view.

## 5. Build it

```bash
fraktul build --out fraktul-dist
```

This writes `fraktul-dist/index.html` and the files it loads. Any static host can serve the folder; see
[Publishing](/docs/publishing).

## Next steps

- [Map it with AI](/docs/ai): let your assistant write the rest.
- [Levels](/docs/levels): systems, services, features, and how many of each you need.
- [Core concepts](/docs/concepts) explains blocks, levels and anchors.
- [The model file](/docs/model) lists every field.
- [The check in CI](/docs/ci) keeps the map honest on every pull request.
