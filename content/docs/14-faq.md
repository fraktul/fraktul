---
title: FAQ and troubleshooting
summary: Common questions, and what to do when the check, a build or the voice fails.
section: Reference
---
## The check says a file "is not in the repo"

```text
✗ node api: file src/api/orders.ts is not in the repo (moved, renamed, deleted, or not tracked by git)
```

Either the path is wrong or git doesn't track the file. fraktul reads only git-tracked files, so a new file counts once
you `git add` it, and an ignored file never does. Paths are relative to the root of the repo, not to the model file.
If the repo has `include:` globs, the file must match one of them too.

## The check says a function is missing

```text
✗ node api: function charge() is not in src/api/payments.ts (renamed or removed?)
```

The code reader looks for functions at the top level and one level in. In TypeScript and JavaScript that means
`function` declarations and `const` or `let` arrow functions; class methods aren't listed. In Python it means `def`,
which includes methods of a top-level class. For anything else, anchor the file instead, or a function that calls it.

## A block id is rejected

Ids are Mermaid box ids, so they must be lowercase letters, digits and underscores, starting with a letter. Rename
`billing-api` to `billing_api` and use the new id in every diagram and tour.

## A repo is "not checked"

```text
Not checked (repo not on this machine): billing
```

The repo's `path` doesn't exist here. This is normal on CI, where only the project is checked out: the check still
verifies everything else. Check the repo out and set `FRAKTUL_REPO_BILLING` to its folder to include it.

## The map shows no source links

Source links come from `remote:`, `github:`, or the checkout's `origin`. A repo with none of them has no links. A
self-hosted server whose name doesn't say what it runs needs `remote_kind`. A build with `FRAKTUL_PUBLIC=1` has no
source links on purpose.

## My code is private. Can I publish the map?

Yes. Build with `FRAKTUL_PUBLIC=1` and the page keeps the blocks, files, functions and who calls whom, but leaves out
source code, file excerpts and links into the repos. For a repo whose contents should never be read at all, set
`private: true`: the map shows its file names only. See [Publishing](/docs/publishing).

## How do I install fraktul?

`npm install --save-dev fraktul`, then `npx fraktul init`. It needs Node 24.21 or newer. fraktul is written in
TypeScript; the npm package is a JavaScript build of the same code, because Node does not strip TypeScript inside
`node_modules`. See the [Quickstart](/docs/getting-started).

## Does fraktul send my code anywhere?

No. The check, the build and the voice all run on your machine. The map is a static page that loads no code from a
CDN or a font service: Mermaid, three.js and the fonts ship with fraktul and are served beside the page, so a map works
on an internal network or offline.

## `fraktul voice` fails

- **On Intel Macs, Linux or Windows:** the voice runs on MLX, which needs Apple silicon. Everything else works; the
  map just has no **Listen** buttons.
- **`uv` not found:** install [uv](https://docs.astral.sh/uv/). fraktul uses it to set up the voice engine's Python.
- **`ffmpeg` not found:** install ffmpeg (`brew install ffmpeg`). It turns each step's audio into MP3.
- **A broken setup:** run `fraktul voice --setup` to set the engine up again.

## A word is pronounced wrong

Add it to `say_as` under the model's `voice:`, spelled the way it should sound:

```yaml
voice: { voice: af_heart, say_as: { NCCI: "N C C I", kubectl: "cube control" } }
```

## The record button is missing

Recording needs the microphone, which browsers allow only on `localhost` or `https://` pages, and a browser with
`MediaRecorder`. Open the map with `fraktul dev` or from an https host.

## Narration plays the old text

Audio is rendered from `say:` when you run `fraktul voice`. After changing the text, run it again and rebuild.

## Does fraktul send my code anywhere?

No. The check, the build and the voice all run on your machine. The built page loads Mermaid and three.js from its own
`vendor/` folder. The only exception is an Artifact page, which loads three.js from a CDN when 3D is switched on.
