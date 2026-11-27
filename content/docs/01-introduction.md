---
title: Introduction
summary: What fraktul is, what problem it solves, and what you get from one model file.
section: Start
---
fraktul draws a map of a software system that you can click down through, from the whole system to a single line of
source. You describe the big pieces once, in one YAML file kept in your project. fraktul reads everything below them
from the code itself.

## The problem it solves

Understanding a system is now the slow part of building software. Someone takes over a project and gets an hour of
handover. An architect explains the same design to every new team. An engineer has to learn another team's service
before building beside it. And with AI writing much of the code, there is more of it every week than anyone has read.

The usual tools don't hold up. Architecture diagrams go stale. They are drawn once, by hand, and nothing tells you when the code moves on. Reading
the code instead shows you every detail but not how the pieces fit together.

fraktul keeps both in one place and ties them together:

- **You write the top.** Blocks, what they do, and how they connect, as plain Mermaid flowcharts.
- **The code writes the bottom.** Files, functions, who calls whom and the source are read from the repo on every
  build, so the deepest levels can't go out of date.
- **A check ties them together.** When the model names a file or function that no longer exists, the check fails,
  so the map breaks in CI instead of quietly lying.

## What you get

| Feature | What it does |
|---|---|
| Every level | Systems, services, features, files and functions in one map, from the big picture to the code. |
| Written by AI | An agent skill teaches your coding assistant to write and update the model. |
| Diagrams you dive into | A box that is another block opens its diagram. Keep clicking: blocks, files, functions, source. |
| Hover peeks | Hover a box to see its summary and a small copy of what's inside. |
| The check | `fraktul check` fails on a missing file, function, decision record, diagram box or tour step. |
| Tours | Step-by-step paths through the map, with branches, written in the model. |
| Narration | Tours spoken by a local neural voice, with the highlight moving as it talks. |
| Recorded walkthroughs | Talk while you click; voice and clicks replay together. |
| Traces | What your OpenTelemetry traces say next to what you drew, and a check when they disagree. |
| Live facts | Numbers and lists read from your project at build time. |
| 3D view | The same level as a place you can fly through. |
| Publishing | A static folder you can host anywhere, with a public mode that leaves the source out. |

## How it fits together

```text
model.yaml  ──►  fraktul check   (every reference must exist)
     │
     └──────►  fraktul build   ──►  one page: diagrams, panels, tours, search
                    ▲
your code  ─────────┘   (files, functions, calls and source, read at build time)
```

fraktul only reads files that git tracks, so anything ignored, licensed or local never ends up in the page.

## What it is not

fraktul is not a diagram editor and does not guess your architecture. The top levels are what you write: they say what
the system is for and how its parts relate, which code can't tell you. fraktul makes sure what you wrote stays true.

## Where to go next

- [Quickstart](/docs/getting-started): a map of your own project in a few minutes.
- [Map it with AI](/docs/ai): have your coding assistant write it.
- [The demo shop](/docs/demo): an online shop of twenty services, mapped from its code and its traces. Open it, or run it yourself.
- [Core concepts](/docs/concepts): blocks, levels, anchors, the check and tours, in one page.
- [Open the live map](/fraktuls/fraktul/): fraktul's own map, built from the example model in its repo.
