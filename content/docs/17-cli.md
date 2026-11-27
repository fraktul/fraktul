---
title: CLI reference
summary: Every fraktul command, flag and environment variable.
section: Reference
---
```text
fraktul <command> [model] [flags]
```

Install it with `npm install --save-dev fraktul` and run it as `npx fraktul`, or as `fraktul` inside a `package.json`
script. Running `fraktul` with no command, or `fraktul --help`, prints the list of commands. `fraktul --version` prints
the version.

**The model argument** is optional. Without it, fraktul uses `./model.yaml`, then `./docs/arch/model.yaml`. When neither
exists it stops with exit code `2` and says so.

## init

```bash
fraktul init [model] [--force] [--no-skill]
```

Writes a starter model from the folders git tracks: one block per big folder with its files anchored, one diagram that
shows the blocks, and a short tour. The result passes the check as written. Replace each `TODO` and draw the arrows.
Without a path it writes `docs/arch/model.yaml`.

| Flag | Does |
|---|---|
| `--force` | Replace a model file that already exists. Without it, `init` stops with exit code `2`. |
| `--no-skill` | Don't install the agent skill. Without it, `init` also copies the skill into `.claude/skills` and `.agents/skills`. |

## check

```bash
fraktul check [model] [--strict] [--json]
```

Checks every anchor, diagram box, narration cue and tour step against the code. See
[The check in CI](/docs/ci).

| Flag | Does |
|---|---|
| `--strict` | Also fail on files and decision records the model doesn't mention, and on calls and services the traces show that the map does not. |
| `--json` | Print the report as JSON. |

## traces

```bash
fraktul traces <source>... [--model path] [--lookback 1h] [--limit 200] [--mermaid]
```

Reads OpenTelemetry traces and writes `traces.json` beside the model: the services, the calls between them, error
counts and latency. A source is an OTLP JSON file, a folder of them, or the address of a Jaeger query service. See
[Traces](/docs/traces).

| Flag | Does |
|---|---|
| `--model <path>` | The model to write beside. Default: the usual two places. |
| `--lookback <time>` | From Jaeger: how far back to read (`30m`, `1h`, `2d`). Default `1h`. |
| `--limit <n>` | From Jaeger: traces to read per service. Default `200`. |
| `--mermaid` | Print the observed service graph as a Mermaid flowchart and write nothing. |

## skill

```bash
fraktul skill [--dir path]
```

Installs the fraktul agent skill into `.claude/skills/fraktul` and `.agents/skills/fraktul`, replacing an older copy.
See [Map it with AI](/docs/ai).

## dev

```bash
fraktul dev [model] [--port 8080]
```

Serves the map at `http://localhost:8080` and rebuilds it when anything in the model's folder changes: the model, the
live module, recordings and narration audio.

| Flag | Does |
|---|---|
| `--port <n>` | Port to serve on. Default `8080`. |

## build

```bash
fraktul build [model] [--out fraktul-dist]
```

Builds the map into a folder for static hosting: `index.html`, `vendor/`, and `voice/` and `recordings/` when there
are any. The folder is replaced on every build. See [Publishing](/docs/publishing).

| Flag | Does |
|---|---|
| `--out <dir>` | Output folder. Default `fraktul-dist`. |

## artifact

```bash
fraktul artifact [model] [--out fraktul-dist]
```

Runs `build`, then also writes `artifact.html` into the same folder: the page as one fragment, without `<html>` and
`<head>` and with Mermaid inside it, for a host that wraps the page in its own document and can't serve files beside
it. Most projects want `build`.

| Flag | Does |
|---|---|
| `--out <dir>` | Output folder. Default `fraktul-dist`. |

## voice

```bash
fraktul voice [model] [--tour <id>] [--voice <name>] [--setup]
```

Speaks the `say:` narration of every tour step with Kokoro, locally, and writes the audio to `.fraktul/voice/` next to
the model. Needs Apple silicon, uv and ffmpeg. See [Tours and narration](/docs/tours).

| Flag | Does |
|---|---|
| `--tour <id>` | Render only this tour. |
| `--voice <name>` | Use this Kokoro voice for every tour, overriding the model. |
| `--setup` | Set up the voice engine again (a uv environment with mlx-audio and Kokoro). It is set up automatically the first time. |

## import-recording

```bash
fraktul import-recording <walkthrough.json> [model]
```

Takes a walkthrough saved from the map's recorder and writes its events and audio into `recordings/` next to the
model. See [Recorded walkthroughs](/docs/recordings).

## Environment variables

| Variable | Does |
|---|---|
| `FRAKTUL_URL` | The address the map will be published at. Adds a canonical link and `og:url` to the page. |
| `FRAKTUL_PUBLIC=1` | Build without source code, file excerpts or links into the repos. See [Publishing](/docs/publishing#public-builds-of-private-code). |
| `FRAKTUL_REPO_<KEY>` | Read the repo `<key>` from this path instead of its `path:`. The key is upper-cased, with other characters as `_`: `FRAKTUL_REPO_BILLING`. |

## In the map

| Key | Does |
|---|---|
| <kbd>/</kbd> | Search |
| <kbd>Esc</kbd> | Close the peek, clear the selection, then go up a level |
| <kbd>U</kbd> or <kbd>Backspace</kbd> | Go up a level (also with the mouse locked in 3D) |
| <kbd>0</kbd> | Fit the diagram to the screen |
| <kbd>3</kbd> | Switch the 3D view on or off |
| <kbd>Space</kbd> | Pause or resume narration |
| <kbd>→</kbd> | Next tour step |

A link can open the map on a block: add `#billing-api` to the map's URL to open the block `billing_api` (underscores
are written as dashes). The address bar follows as you click, so you can copy a link to any block.
