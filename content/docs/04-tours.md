---
title: Tours and narration
summary: Walk someone through the system, in writing or in a real voice.
---
A tour is a path through the map. Each step shows one diagram with a few boxes highlighted and a short card of text.

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
      - view: api
        focus: [charge]
        title: Payment
        text: The API charges the card before anything is stored.
        branches:
          - { label: "Card declined", to: declined }
```

Steps follow each other in order unless one sets `next`. `branches` offer other paths; `to` is a step id or
`tour:<id>` to jump into another tour. The check fails on a missing view, focus box or step.

## Narration

Give a step `say:` and fraktul can speak it. Write what a guide would say, which is usually more than the card shows:

```yaml
        say: >-
          Everything starts when the customer presses pay. [[web]] The web app sends the cart to the API.
          [[api, charge]] The API charges the card first, so a failed payment never leaves a half-made order.
```

`[[box, other]]` moves the highlight at that point of the speech. Then:

```bash
node ~/github/fraktul/bin/fraktul.ts voice docs/arch/model.yaml
```

fraktul speaks each sentence with Kokoro, a small neural voice model, on your Mac's GPU. Because every sentence is
spoken on its own, captions and highlights land exactly on time, and only changed sentences are spoken again. The
audio goes to `.fraktul/voice/` next to the model; keep it out of git, it rebuilds from the text.

Codes like `77427` are read digit by digit. Words the voice gets wrong go in `voice.say_as`:

```yaml
voice: { voice: bf_emma, say_as: { NCCI: "N C C I" } }
```

## Listening

In the map, **Listen** plays a tour. Captions follow the voice, the highlight moves with the cues, and the tour moves on
by itself, pausing at branches so the listener can choose.
