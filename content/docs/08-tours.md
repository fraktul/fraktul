---
title: Tours and narration
summary: Walk someone through the system in writing, or in a real voice spoken on your own Mac.
section: Guides
---
A tour is a path through the map. Each step shows one diagram, highlights a few boxes and shows a short card of text.
Readers open tours from **Tours** in the map's top bar.

## Write a tour

```yaml
tours:
  - id: one-order
    title: Follow one order
    summary: From the cart to the receipt.
    steps:
      - id: checkout
        view: shop
        focus: [web, api]
        title: The customer checks out
        text: The web app sends the cart to the API.
      - id: pay
        view: api
        focus: [charge]
        title: Payment
        text: The API charges the card before anything is stored.
        branches:
          - { label: "Card declined", to: "tour:declined" }
      - view: api
        focus: [store]
        title: The order is stored
        text: Only a paid order is written to the database.
  - id: declined
    title: A declined card
    summary: What happens when payment fails.
    steps:
      - view: api
        focus: [charge]
        title: The card is declined
        text: Nothing is stored, and the customer can try another card.
        next: pay
```

These tours assume `shop`'s diagram has boxes `web` and `api`, and `api`'s diagram has `charge` and `store`. The
branch jumps into the second tour, whose step goes back to `pay` with `next`.

### Step fields

| Field | What it does |
|---|---|
| `view` | Required. The block whose diagram is shown. It must have a diagram. |
| `title`, `text` | Required. The card's heading and text. |
| `focus` | Boxes to highlight. `block/inner` highlights a box inside an expanded block. |
| `expand` | Blocks to draw open in this step, so `focus` can reach inside them. |
| `id` | Needed when something jumps to this step. Default: `<tour id>-<n>`. Unique across all tours. |
| `next` | The step that follows. Default: the next one in the list. |
| `branches` | Other ways on: `{ label, to }`, where `to` is a step id or `tour:<id>`. |
| `say` | Narration to speak (below). |

The check fails on a missing view, focus box, expanded block, narration cue or target step.

> [!TIP]
> Write a tour for each question people actually ask: "what happens when an order comes in?", "where does this number
> come from?". A tour that follows one piece of data through the system is easier to follow than a tour of components.

## Narration

Give a step `say:` and fraktul can speak it. Write what a guide would say out loud, which is usually more than the card
shows:

```yaml
      - id: checkout
        view: shop
        focus: [web, api]
        title: The customer checks out
        text: The web app sends the cart to the API.
        say: >-
          Everything starts when the customer presses pay. [[web]] The web app sends the cart to the API.
          [[api]] The API charges the card first, so a failed payment never leaves a half-made order.
```

`[[box, other]]` is a **cue**: from that point of the speech, those boxes are highlighted. A cue must name boxes in the
step's `view`, like `focus` does.

## Render the voice

```bash
fraktul voice
```

fraktul speaks every step that has `say:` with Kokoro, a small neural voice model, running locally through MLX. Nothing
is sent anywhere. The first run sets up a Python environment with uv (Python 3.13, mlx-audio and the Kokoro model).

Every sentence is spoken on its own, so captions and cues land exactly on time, and a sentence that hasn't changed is
not spoken again. Audio goes to `.fraktul/voice/` next to the model.

> [!WARNING]
> Voice needs a Mac with Apple silicon, [uv](https://docs.astral.sh/uv/) and ffmpeg on the `PATH`. The rest of fraktul
> runs anywhere, and a map without rendered audio simply has no **Listen** button.

> [!NOTE]
> Keep `.fraktul/` out of git: it is rebuilt from the text. Add `.fraktul/` to your `.gitignore`. To publish narration,
> render it on a Mac before you build.

Options: `--tour <id>` renders one tour, `--voice <name>` overrides the voice, `--setup` runs the engine's setup again.

## Voice settings

```yaml
voice: { voice: bf_emma, speed: 1, say_as: { SKU: "S K U", SQL: "sequel" } }

tours:
  - id: one-order
    title: Follow one order
    summary: From the cart to the receipt.
    voice: { voice: am_michael }
    steps:
      - view: shop
        title: The customer checks out
        text: The web app sends the cart to the API.
        say: Everything starts when the customer presses pay.
```

- `voice`: a Kokoro voice such as `af_heart` (the default), `am_michael`, `bf_emma` or `am_fenrir`. Names starting
  with `b` speak British English.
- `speed`: `1` is normal.
- `say_as`: words the voice gets wrong, and how to say them. Set it on the model's `voice:`.
- A tour's own `voice:` overrides the model's for that tour.

Codes like `77427` or `G2212` (an order number, a part number) are read digit by digit. Four-digit years starting with 19 or 20 stay years.

## Listening

In the map, **Listen** plays a tour. Captions follow the voice, the highlight moves with the cues, and the tour moves on
by itself, pausing at branches so the listener can choose. **Space** pauses and resumes; the right arrow goes to the
next step.

The tour card is a small window: drag it by its title bar to wherever it's out of the way (the map remembers where),
fold it to its title bar with **–**, and unfold it with the same button. The voice keeps going while it's folded. In 3D,
the camera follows the tour from block to block.

If you change a step's `say:` text, run `fraktul voice` again. Audio for steps that no longer exist is left out of the
next build.
