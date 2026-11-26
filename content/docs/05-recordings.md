---
title: Recorded walkthroughs
summary: Talk while you click; your voice and every step are saved together.
---
Some explanations are better in a person's own words. Open **Tours**, then **Record a walkthrough**. fraktul records
your microphone and every view you open, every box you hover and every box you click.

When you stop, you can play it back, then save it. Saving downloads one file. Add it to the map:

```bash
node ~/github/fraktul/bin/fraktul.ts import-recording ~/Downloads/how-orders-work-2026-11-26.json docs/arch/model.yaml
```

That writes the recording into `recordings/` next to the model. Commit it, and the next build lists it under the tours.
Playing it replays your voice with the map following along: the same views, the same boxes, at the same moments.

Recording needs the local map (`fraktul dev`) and a browser that allows the microphone.
