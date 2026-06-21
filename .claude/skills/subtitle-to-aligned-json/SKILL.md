---
name: subtitle-to-aligned-json
description: Use when the user gives YouTube subtitle SRT files (an EN+KO pair, or an English-only SRT) for the Tablo English Lab app and wants them turned into the app's aligned-pairs JSON. Covers meaning-based hand-alignment, natural Korean rewriting, sentence splitting, and timestamp back-tracing. Symptoms: "json 변환", "의미 기반 정렬", "자막 정렬", DownSub srt, 429 rate limit avoidance.
---

# Subtitle → Aligned JSON

## Overview

Convert raw YouTube subtitle SRT files into the app's aligned-pairs JSON
(`{title, pairs:[{i, start, end, en, ko}]}`) by **manual meaning-based alignment**,
NOT time-based and NOT via the in-app Gemini AI (which hits 429 free-tier limits).

**Core principle:** You (the assistant) do the alignment by hand in a Python build
script. Time-based auto-alignment was tried and rejected — English caption boundaries
don't match Korean sentence boundaries, so phrases leak across lines.

Output goes in `samples/<slug>.json` (+ `.en.srt` / `.ko.srt`), built by a
`samples/build_<slug>.py` script. User imports the JSON via the ✎ button → English
file slot.

## When to Use

- User pastes/attaches an **EN srt + KO srt pair** (e.g. DownSub) → use the **pair flow**
- User attaches an **English-only srt** → use the **English-only flow**
- User says "의미 기반 정렬", "json 변환 및 저장", "한국어는 네가 자연스럽게 작성"

**Not for:** in-app live alignment (that's the Gemini path in index.html, rate-limited).

## The Two Flows

| | EN+KO pair | English-only |
|--|-----------|--------------|
| **Timestamp source** | KO srt cues, verbatim | back-traced from EN word stream |
| **English** | hand meaning-aligned + ASR fixes | re-split into sentences + ASR fixes |
| **Korean** | rewritten natural 구어체 (discard DownSub MT) | written from scratch, natural 구어체 |
| **Reference script** | `samples/build_restaurant.py` | `samples/build_experiences.py` |

## Pair Flow (EN + KO)

1. Read KO srt → extract `(start, end, text)` per cue. **Timestamps come from KO only.**
2. Hand-write `EN[]`: one English string per KO cue, **meaning-matched** to that
   Korean line. Fix ASR errors (proper nouns, food terms, homophones).
3. Hand-write `KO[]`: natural conversational Korean translated from the *corrected*
   English (do NOT keep the machine translation — it's often wrong).
4. `assert len(EN) == len(KO) == len(ko_cues)`; verify 0 empty lines.
5. Emit `{i, start, end, en, ko}` pairs → JSON (+ regenerate .en.srt/.ko.srt).

## English-only Flow

1. Re-split ASR captions into **sentences** (caption line breaks ≠ sentence
   boundaries; split on punctuation + meaning). Fix ASR errors.
2. **Back-trace timestamps:** build a word→time stream from the cues; for each
   sentence, find its opening words in the stream to get `start`. `end` = next
   sentence's `start` (interpolate the last one).
3. Write natural 구어체 Korean from scratch for each sentence.
4. Emit pairs → JSON as above.

## Build Script Template

Copy `samples/build_restaurant.py` (pair) or `samples/build_experiences.py`
(English-only) and adapt. Skeleton for the pair flow:

```python
# -*- coding: utf-8 -*-
import re, json, io
KO_SRC = r"C:\...\[Korean] <video> [DownSub.com].srt"
OUT    = r"C:\Users\pponi13468\Desktop\박미정\podcast\samples\<slug>"
TS = re.compile(r"(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})")

def parse(path):
    raw = io.open(path, encoding="utf-8-sig").read().replace("\r", "")
    cues = []
    for b in re.split(r"\n\s*\n", raw):
        m = TS.search(b)
        if not m: continue
        lines = b.split("\n"); ti = next(i for i, l in enumerate(lines) if "-->" in l)
        txt = re.sub(r"\s+", " ", " ".join(l.strip() for l in lines[ti+1:])).strip()
        a, z = m.group(0).split(" --> ")
        cues.append((a, z, txt))
    return cues

ko = parse(KO_SRC)
EN = [ ... ]   # one hand-aligned English line per KO cue
KO = [ ... ]   # one natural Korean line per cue (rewrite, don't reuse MT)
assert len(EN) == len(KO) == len(ko), (len(EN), len(KO), len(ko))

pairs = [{"i": i+1, "start": ko[i][0], "end": ko[i][1], "en": EN[i], "ko": KO[i]}
         for i in range(len(ko))]
title = "<Video Title>"
json.dump({"title": title, "pairs": pairs},
          io.open(OUT + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

def w(suffix, key):
    with io.open(OUT + suffix, "w", encoding="utf-8") as f:
        for p in pairs:
            f.write(f'{p["i"]}\n{p["start"]} --> {p["end"]}\n{p[key]}\n\n')
w(".en.srt", "en"); w(".ko.srt", "ko")
print("pairs:", len(pairs), "empty EN:", sum(1 for p in pairs if not p["en"].strip()))
```

## Output Format

```json
{
  "title": "How To Order Food In a Restaurant",
  "pairs": [
    { "i": 1, "start": "00:00:01,291", "end": "00:00:04,500",
      "en": "hey everybody", "ko": "여러분 안녕하세요" }
  ]
}
```

`parseAlignedJson` in index.html accepts this directly and **skips AI alignment**,
so import is instant and immune to 429.

## How the User Applies It

1. Run the build script: `python samples/build_<slug>.py`
2. In the app: 자막 입력 ✎ → **English file slot** → pick `samples/<slug>.json` → apply.

## Common Mistakes

- ❌ Time-based / word-bucket alignment → boundaries leak ("in today's" bleeds across lines). Always hand-align by meaning.
- ❌ Keeping DownSub Korean → frequent mistranslations. Rewrite Korean from the corrected English.
- ❌ Forgetting the length assert → silent off-by-one misalignment for the whole file.
- ❌ Using EN srt timestamps in the pair flow → KO is the reference clock; use KO cue times.
