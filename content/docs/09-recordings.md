---
title: Recorded walkthroughs
summary: Talk while you click; your voice and every step are saved together and replay in sync.
section: Guides
---
Some explanations are better in a person's own words. A recorded walkthrough captures your microphone together with
every view you open, every box you hover and every box you click. Played back, the map follows along: the same views,
the same boxes, at the same moments.

## Record

1. Open the map, for example with `fraktul dev`.
2. Open **Tours**, then **Record a walkthrough**.
3. Allow the microphone, then talk while you click through the map.
4. **Stop**, then **Play it back** to check it.
5. Give it a title, a line about it and your name, then **Save file**. The browser downloads one `.json` file with the
   audio inside.

> [!NOTE]
> Browsers only allow the microphone on `localhost` or `https://` pages. The record button is hidden in a browser that
> can't record.

## Add it to the map

```bash
fraktul import-recording ~/Downloads/how-orders-work.json
```

This writes two files into `recordings/` next to the model: the walkthrough's events (`<id>.json`) and its audio
(`<id>.webm`, or `<id>.m4a` when the browser records MP4 audio, as Safari does). Pass the model path as a second argument if it isn't in a default location.

Commit both files. The next build lists the walkthrough under the tours, and `fraktul build` copies the audio next to
the page.
