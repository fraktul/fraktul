---
title: Quickstart
summary: Install fraktul, write a first model, check it, and open the map.
section: Start
---
This page takes you from nothing to a map of your own project. You need about ten minutes and a project in a git
repository.

## Requirements

- **Node 24.21 or newer.** fraktul is written in TypeScript and runs on Node's own type stripping.
- **A git checkout** of the project you want to map. fraktul reads only files git tracks.
- **For narrated tours only:** a Mac with Apple silicon, plus [uv](https://docs.astral.sh/uv/) and ffmpeg. Everything
  else works on any system.

## 1. Get fraktul

There are two ways to run fraktul. They take the same commands and flags.

**From a checkout** (works today). Clone fraktul once, next to your projects:

```bash
git clone git@github.com:rinsesoft/fraktul.git ~/github/fraktul
```

Then run it from your project with `node ~/github/fraktul/bin/fraktul.ts <command>`. The first run installs fraktul's
own dependencies inside the checkout.

**From npm.** Once fraktul is published, add it to the project and use `npx`:

```bash
npm install --save-dev fraktul
npx fraktul check
```

> [!NOTE]
> The npm package is not published yet. Until it is, use the checkout. Every example in these docs writes
> `fraktul <command>`: from a checkout that means `node ~/github/fraktul/bin/fraktul.ts <command>`.

## 2. Write a first model

Create `docs/arch/model.yaml` in your project. fraktul looks for `./model.yaml` and then `./docs/arch/model.yaml`, so
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

- [Core concepts](/docs/concepts) explains blocks, levels and anchors.
- [The model file](/docs/model) lists every field.
- [The check in CI](/docs/ci) keeps the map honest on every pull request.
