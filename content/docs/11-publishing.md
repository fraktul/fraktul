---
title: Publishing
summary: Build the map into static files and host it anywhere, or publish it as a claude.ai Artifact.
section: Guides
---
A built map is static files: no server code, no database. Any host that serves files can serve it.

## Build

```bash
fraktul build --out fraktul-dist
```

`--out` defaults to `fraktul-dist`. The folder holds:

| Path | What it is |
|---|---|
| `index.html` | The map: styles, diagrams and all the model and code data in one page. |
| `vendor/` | fraktul's own copies of Mermaid, three.js and the fonts. The page loads nothing from a CDN or a font service. |
| `voice/` | Narration audio, when you ran `fraktul voice`. |
| `recordings/` | Audio of recorded walkthroughs, when the model has any. |

Build where the code is checked out. The page carries what the build read: functions, calls, source excerpts and
source links pinned to the commit. A repo that isn't checked out is left out of the code levels.

## What a build includes

Everything in the page comes from git-tracked files the model points at, plus the files they import, a few levels
deep. Files in a repo marked `private: true` appear by name only.

> [!WARNING]
> A built page contains the source of every function it shows. Publish it only where the source may be read, or
> build with `FRAKTUL_PUBLIC=1` (below).

### Public builds of private code

```bash
FRAKTUL_PUBLIC=1 fraktul build --out fraktul-dist
```

With `FRAKTUL_PUBLIC=1`, the page keeps the map's structure (blocks, files, functions and who calls whom) but leaves out
source code, file excerpts and links into the repos. fraktul.dev publishes fraktul's own map this way.

## Static hosting

Upload the whole folder. Some common setups:

- **GitHub Pages, Netlify, Vercel:** publish the output folder as the site root.
- **Cloudflare Workers or Pages:** serve the folder as static assets, for example with Wrangler and an `assets`
  directory set to the output folder.
- **Any web server:** copy the folder under the document root.

Audio files need to be served with their normal content types (`audio/mpeg`, `audio/webm`), which every common host
does.

## Build in CI

Building in CI keeps the published map in step with the code. In GitHub Actions, after the check:

```yaml
- run: npx fraktul build --out fraktul-dist
- uses: actions/upload-pages-artifact@v3
  with: { path: fraktul-dist }
```

See [The check in CI](/docs/ci) for getting fraktul into the workflow. Narration can't be rendered on a Linux runner,
so a map built in CI has no **Listen** buttons. To publish narration, build on the Mac that ran `fraktul voice`.

## claude.ai Artifacts

```bash
fraktul artifact --out fraktul-dist
```

This runs a normal build, then writes `fraktul-dist/artifact.html`: the page without its `<html>` and `<head>`
wrapper, with Mermaid inlined so the page works alone. three.js loads from a CDN the first time 3D is switched on.
Publish `voice/` and `recordings/` beside it if the map uses them.
