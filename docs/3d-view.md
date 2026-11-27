# The 3D view: a memory palace for a system

Status: phase 1 is built (`src/components/fraktul-map/map3d.ts`); the rest is design. Written from a design
conversation on Nov 25–26, 2026. How to use the view: `content/docs/09-3d-view.md`.

## Why

fraktul exists to help people understand a system that someone else wrote, more and more often an AI. The 2D map
shows that understanding as diagrams. The 3D view turns the same map into a place you can fly through, so the system
becomes something you remember the way you remember a city: where things are, what is next to what, and how you get
from one to the other.

The view does not pretend code is a galaxy, a city or a filing cabinet. A fixed ladder of metaphors breaks, because
fraktul's depth differs from block to block. Instead, **every level is a real, consistent place you can learn.**
Memory palaces work because places are distinct, stable, have landmarks and are travelled by routes, not because they
are realistic. Everything below serves those four things.

Audience: developers and architects first. It should also make sense to people who don't write code.

## Principles

1. **One source of truth.** The 3D view renders the same build data as the 2D map (`Site` from `src/lib/build.ts`).
   No new model fields are required to get a full 3D map.
2. **Deterministic.** The same model and the same commits always produce the same world. No physics, no randomness.
3. **Meaning comes from data, identity comes from the hash.** Size, colour, solidity and connections are read from
   the model and the code. Decoration (crowns, facets, window patterns, atmosphere) comes from a hash of the node id,
   so it can never mislead, and it stays the same when the code changes.
4. **One move at every depth.** Diving into something always works the same way, however deep you are.
5. **Show a little at a time.** Each level assembles in flow order instead of appearing all at once.
6. **Stays light.** 2D remains the default. three.js loads only when someone switches to 3D.

## Where each piece of information comes from

| Source | What it gives the 3D view |
| --- | --- |
| Model file (written by a person or an AI) | Blocks, `kind`, `status`, summaries, diagram boxes and arrows, tours |
| Mermaid layout (already rendered in the browser) | Exact x/y of every box: the floor plan of each level |
| Code, where a repo is checked out | File line counts, functions, imports and importers, function calls and callers, source text |
| Check report | Files the model never mentions, anchors that no longer exist |
| Remote links (PR #1) | Where "open the source" goes, and whether the repo is private |
| Not available yet | Git churn (how often something changes). Needs a new reader for git history |

Code is optional. A model with no repos still gets a full skyline; you just cannot go inside anything that has no code
behind it.

## Visual language

The look is abstract and dark: a black void, a faint grid fading into fog, shapes drawn mostly as edges and light.
Colours reuse the existing diagram classes from `tokens.css`, so 2D and 3D share one palette.

### Shape: chosen by `kind`, not by depth

| `kind` | Shape family |
| --- | --- |
| district | terrain: a raised region with its contents on top |
| component | tower or machine |
| module | stacked blocks |
| data | crystal or vault |
| service | orb with a ring |
| repo | island |
| person | pillar of light |
| doc | tablet |
| step | gate you pass through (a workflow of steps becomes a path) |
| `status: external` | sealed monolith: smooth, no windows, no door |

The bottom of every dive is fixed: files are slabs of code, functions are cores you walk into, and the source is
around you.

### Encodings from data

- **Size**: lines of code or number of files, where code is linked; otherwise a default size per kind.
- **Status sets solidity**: built is solid, prototype flickers or has scaffolding, planned is a dashed hologram,
  proposed is an outline on the ground.
- **Arrows become light streams** with particles moving in the direction of flow. Inside code levels, streams are real
  calls.
- **Walls show their own code**, scrolling faintly. Close up it sharpens until you can read it. Only git-tracked files
  are read, so the walls show nothing the 2D map would not.

### Identity from the hash

A short hash of the node id (FNV-1a is enough) picks a few traits within the shape family: crown (spire, pyramid,
antenna, flat), setbacks, window pattern, rings, facets. Keep the vocabulary small, around 3 to 4 options per trait,
so buildings are easy to tell apart without becoming noise.

Seeding on the **id, not the content**, is deliberate: editing code makes a block taller or brighter but keeps its
silhouette. Renaming a block gives it a new one.

### Atmosphere per level

Each level (the inside of a block) gets its own fog tint, floor pattern and sky, also hashed from the block id. You
know you are inside billing by the feel before you read a label.

### Trust signals

The 3D view doubles as a check on what the AI wrote:

- Blocks anchored to real code are solid. The check proves those anchors exist.
- A block that says `built` but has no anchors flickers as a warning. Planned and external blocks never warn.
- Files the model never mentions sit at the edge as dark, unmapped ground.
- A repo that is not checked out shows its blocks with lit windows but locked doors.

## Landmarks, routes and arrival

- **Landmarks**: the most connected or largest blocks on a level get a taller crown or a beacon visible from far away.
- **Routes**: tours are fixed flight paths, the same every time. Later, paths that people take often (from
  recordings) could glow brighter, like trails worn into grass.
- **Arrival**: entering a block always happens through the same door, from the same side.

## Moving around

- **Free mode** is first person: mouse to look, WASD to move, click a block to dive in, one key to back out a level.
  The scroll wheel scales you freely, so you can stop halfway and see a block's insides and its neighbours together.
- **Tours run on rails**: the camera flies between steps; a `[[box]]` cue in the narration drops a beam on that box
  and frames it. Branches appear as forks with labels, and the flight pauses there. Any key gives control back.
- **Recordings** already capture views, hovers and clicks. Adding the camera position lets a recording replay a
  flight.
- **HUD**: a depth trail (`fraktul › build the map › build.ts › buildSite()`) that grows and shrinks as you scale,
  with each part clickable, plus an optional scale readout (`×100`). Labels face the camera and fade with distance.
- **The side panel stays as it is.** Clicking anything opens the same file, function or block panel as in 2D.

## The dive: continuous scale

Diving works like Katamari Damacy in reverse: no cuts and no loading screens between levels.

- A block's children really live inside its footprint, laid out from its own Mermaid diagram (or the generated file
  and function diagram) and scaled down about 10× per level.
- As you approach, the block's walls turn to glass and its contents become visible; then they become your whole world.
  Neighbours from the level above become giant walls at the edges.
- Backing out plays the same motion in reverse, and you watch the block settle back into its place.
- Open question: whether the giant walls stay all the way down or fade after a level or two.

### Technical notes

- **Floating origin**: the camera always stays at unit scale and the world is rescaled around it. Each level gets its
  own local coordinates. This avoids the jitter that floating-point maths causes after a few 10× zooms.
- **Draw three levels at a time**: the level you are in, the parent around you, and simple shapes for the children you
  could dive into. Big systems then cost the same as small ones.
- **Layout comes from Mermaid**: read box positions from the rendered SVG so 3D matches 2D exactly.

## The reveal

On entering a level, nothing is there. Blocks rise one at a time in flow order (topological order of the diagram's
arrows: sources first, then what they feed), and each stream lights up as the block it points at arrives. Inside a
block, files rise in import order. Tour steps bring in only the boxes they mention.

## Into and out of 3D

- A **3D toggle** on the same map, same URL and same selection. Switching back keeps your place.
- The entry animation: the flat diagram tilts away like a table, boxes extrude into their shapes, arrows lift into
  light streams, and the camera swoops down to street level. Because the layout matches, nothing jumps.

## Fit with the rest of fraktul

- Ships as a separate module that the map loads on demand (`import()` on first toggle), so the 2D page does not get
  heavier. Works with the existing `flat` and `y2k` styles.
- Reads `SITE` as it is; new fields only for new data (for example churn).
- Repos could appear as islands or districts with bridges between them. Open question: islands per repo, or business
  areas that cut across repos.

## Phases

1. **Static city**: one level in 3D from the Mermaid layout, shapes by kind, encodings by status, labels, click to open
   the existing panel, the 3D toggle and the entry animation.
2. **The dive**: continuous scaling, floating origin, three levels drawn, depth trail, back out.
3. **Code levels**: files and functions as places, call streams, code on the walls.
4. **Tours on rails**: camera paths, cue beams, branches, narration.
5. **Identity**: hashed traits, per-level atmosphere, landmarks, the reveal.
6. **Later**: churn from git history, worn paths from recordings, sound, time travel through history.

## Open questions

- Sound: a low ambient hum and soft chimes on cues, or nothing?
- Time travel: scrub through git history and watch the system get built. First version or later?
- Does the reveal play every time you enter a level, or only the first time, with a hotkey to replay it?
- Do the parent's giant walls stay all the way down, or fade?
- Multi-repo systems: islands per repo, or areas that cut across repos?
