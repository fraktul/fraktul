---
title: Keeping the map true
summary: Diagrams go out of date the day they are drawn. How fraktul notices, and a routine that keeps the map right.
section: Guides
---
We all know diagrams go out of date almost as soon as they are drawn. A service is split, a queue is added, a module
is renamed, and nobody updates the picture, because nothing tells them to. After a while the diagram is wrong in ways
nobody can list, so nobody trusts it.

**Nothing fails when a diagram is wrong**, so nobody fixes it. fraktul's answer is a map that can fail.

## Three things can be wrong

| What drifts | Example | What notices |
|---|---|---|
| The map points at code that moved | A file was renamed; a function was deleted | `fraktul check` fails |
| The code grew and the map did not | A new module nobody added to any block | `fraktul check` lists it; `--strict` fails |
| The system talks differently than drawn | Checkout started calling a new service | `fraktul check` with [traces](/docs/traces) lists it; `--strict` fails |

Below the levels you write, nothing can drift at all: files, functions, calls and source are read from the code
on every build.

## The routine

**1. Keep the model next to the code.** `docs/arch/model.yaml`, in the same repo, reviewed in the same pull
requests. A map in a wiki is a map nobody updates.

**2. Run the check on every pull request.** [The check in CI](/docs/ci) takes a few seconds. A change that moves
a file the map names now fails until the map is fixed, in the same pull request, by the person who knows why it
moved.

**3. Turn on `--strict` once coverage is clean.** Say which files matter with `coverage:` in the model, map them,
then run `fraktul check --strict`. From then on new code has to be put somewhere on the map before it merges.

**4. Let your assistant do the edits.** With the [agent skill](/docs/ai) installed, "the check failed, fix the map"
is a one-line request. Most fixes are one anchor.

**5. Refresh the traces on a schedule.** Run `fraktul traces` against production weekly, or in CI, and commit
`traces.json`. The check then tells you when the running system has grown an arrow the map lacks.

**6. Rebuild and publish on every merge.** [Build in CI](/docs/publishing#build-in-ci) so the published map is the
map of `main`, with source links pinned to the commit it was built from.

## Facts that change

Don't type numbers into summaries. "Handles 40 tenants" is wrong next quarter. Use [live facts](/docs/live-facts):
values read from the project at build time, such as the latest test run or a count from a config file.

## Decisions

Why a thing is the way it is goes stale too, more quietly. Point blocks at their
[decision records](/docs/live-facts#decision-records). The panel shows each record's status, and the check fails
when a record a block cites is deleted.

## Keeping the whole system together

One map can span every repo a system lives in. List them under `repos:` and anchor each block where its code is.
The system level then shows all of it at once, and each service's level links into its own repo. Repos that aren't
checked out on a given machine are skipped and named, so the check still runs everywhere. See
[The model file](/docs/model#repos).

## What a check cannot do

The check proves the map matches the code. It cannot prove a summary is true or a diagram is the clearest one.
Review the words when the design changes, the way you would review any documentation, and ask the people who use
the map whether it still explains the system. A [tour](/docs/tours) recorded a year ago is a good test: if it still
makes sense, the top of the map is holding.
