"""Speak tour narration with Kokoro on MLX, entirely on this Mac.

Reads a job from stdin: {"model": ..., "voice": ..., "speed": ..., "out": dir, "say_as": {...},
"steps": [{"tour", "step", "text"}]}. Narration text may hold cues, `[[box, other]]`: from that point the map
highlights those boxes. Each sentence is spoken on its own (cached by content), so caption and cue times are exact.
Writes <out>/<tour>/<step>.mp3 and the manifest (durations, cues, captions) as JSON to job["manifest"].
"""
import hashlib, json, os, re, subprocess, sys
import numpy as np, soundfile as sf

RATE = 24000
GAP = 0.32      # pause between sentences, seconds
CUE_GAP = 0.18  # extra pause where a cue moves the map, so the eye can follow

def sentences(text):
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    parts = re.split(r"(?<=[.!?:;])\s+(?=[\"'(A-Z0-9])", text)
    return [p.strip() for p in parts if p.strip()]

def chunks(text):
    """Split at cues: [(cue_or_None, text)]."""
    out, cue, pos = [], None, 0
    for m in re.finditer(r"\[\[([^\]]*)\]\]", text):
        out.append((cue, text[pos:m.start()]))
        cue = [c.strip() for c in m.group(1).split(",") if c.strip()]
        pos = m.end()
    out.append((cue, text[pos:]))
    return [(c, t) for c, t in out if c is not None or t.strip()]

def spoken(s, say_as):
    for k, v in say_as.items():
        s = re.sub(rf"\b{re.escape(k)}\b", v, s)
    # Codes read digit by digit: 77427 → 7 7 4 2 7, G2212 → G 2 2 1 2. Years stay years.
    def code(m):
        word = m.group(0)
        if re.fullmatch(r"(19|20)\d\d", word):
            return word
        return " ".join(word)
    s = re.sub(r"\b[A-Z]?\d{4,5}\b", code, s)
    return s.replace("→", " to ").replace("×", " times ").replace("≥", " at least ").replace("–", " to ")

def main():
    job = json.load(sys.stdin)
    sys.stdout = sys.stderr  # the TTS libraries print progress; keep stdout clean
    from mlx_audio.tts.utils import load_model
    model = load_model(job["model"])
    voice, speed, out = job["voice"], float(job.get("speed", 1.0)), job["out"]
    lang = "b" if voice.startswith("b") else "a"
    cache = os.path.join(out, "cache")
    os.makedirs(cache, exist_ok=True)
    manifest = {}

    def synth(text):
        key = hashlib.sha256(f"{job['model']}|{voice}|{speed}|{text}".encode()).hexdigest()[:24]
        path = os.path.join(cache, key + ".wav")
        if not os.path.exists(path):
            parts = [np.array(r.audio).reshape(-1) for r in model.generate(text=text, voice=voice, speed=speed, lang_code=lang)]
            sf.write(path, np.concatenate(parts) if parts else np.zeros(1), RATE)
        a, _ = sf.read(path, dtype="float32")
        return a

    for st in job["steps"]:
        audio, cues, caps, t = [], [], [], 0.0
        for cue, text in chunks(st["text"]):
            if cue is not None:
                if t > 0:
                    audio.append(np.zeros(int(CUE_GAP * RATE), dtype="float32")); t += CUE_GAP
                cues.append({"t": round(t, 2), "focus": cue})
            for s in sentences(text):
                a = synth(spoken(s, job.get("say_as", {})))
                caps.append({"t": round(t, 2), "end": round(t + len(a) / RATE, 2), "text": s})
                audio.append(a); t += len(a) / RATE
                audio.append(np.zeros(int(GAP * RATE), dtype="float32")); t += GAP
        if not audio:
            continue
        d = os.path.join(out, st["tour"])
        os.makedirs(d, exist_ok=True)
        wav = os.path.join(cache, f"_{st['tour']}_{st['step']}.wav")
        sf.write(wav, np.concatenate(audio), RATE)
        mp3 = os.path.join(d, f"{st['step']}.mp3")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-ac", "1", "-b:a", "64k", mp3], check=True)
        os.remove(wav)
        manifest[st["step"]] = {"file": f"voice/{st['tour']}/{st['step']}.mp3", "duration": round(t, 2), "cues": cues, "captions": caps}
        print(f"  {st['tour']}/{st['step']}: {t:.1f} s", file=sys.stderr)
    with open(job["manifest"], "w") as f:
        json.dump(manifest, f)

if __name__ == "__main__":
    main()
