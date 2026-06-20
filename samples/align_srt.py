# -*- coding: utf-8 -*-
"""
Align a word-level English SRT to a sentence-level Korean SRT by TIME.
Same method as the app's alignWordsToKo: interpolate each English word's time
within its cue, then bucket each word into the Korean cue it falls in.
Produces an English SRT whose cues match the Korean cues 1:1 (same timestamps),
so the app lines them up with zero drift and without needing the AI key.
"""
import re, json, sys, io

# Usage:
#   python align_srt.py <english.srt> <korean.srt> <out_base>
# Defaults to the Cincinnati "what do you do for a living" sample if no args given.
DL = r"C:\Users\pponi13468\Downloads"
EN_SRC = DL + r"\[English (auto-generated)] Asking people What do you do for a living in USA [DownSub.com].srt"
KO_SRC = DL + r"\[Korean] Asking people What do you do for a living in USA [DownSub.com].srt"
OUT_BASE = r"C:\Users\pponi13468\Desktop\박미정\podcast\samples\asking-living"
if len(sys.argv) >= 4:
    EN_SRC, KO_SRC, OUT_BASE = sys.argv[1], sys.argv[2], sys.argv[3]

TS = re.compile(r"(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})")

def to_sec(h, m, s, ms):
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

def fmt(t):
    if t < 0: t = 0
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def parse_srt(path):
    with io.open(path, encoding="utf-8-sig") as f:
        raw = f.read()
    blocks = re.split(r"\n\s*\n", raw.replace("\r", ""))
    cues = []
    for b in blocks:
        m = TS.search(b)
        if not m:
            continue
        start = to_sec(*m.group(1, 2, 3, 4))
        end = to_sec(*m.group(5, 6, 7, 8))
        # text = everything after the timestamp line
        lines = [ln for ln in b.split("\n")]
        ti = next(i for i, ln in enumerate(lines) if "-->" in ln)
        text = " ".join(ln.strip() for ln in lines[ti + 1:]).strip()
        text = re.sub(r"\s+", " ", text)
        cues.append({"start": start, "end": end, "text": text})
    return cues

ko = parse_srt(KO_SRC)
en = parse_srt(EN_SRC)

# Build interpolated English word stream, dropping noise tokens.
words = []
for c in en:
    toks = [w for w in c["text"].split(" ") if w]
    toks = [w for w in toks if w.lower() not in ("[music]",)]
    n = len(toks)
    if n == 0:
        continue
    span = max(c["end"] - c["start"], 0.001)
    for k, w in enumerate(toks):
        t = c["start"] + (span * k / n if n > 1 else 0)
        words.append((w, t))

# Bucket each word into the Korean cue it belongs to (last ko.start <= word time).
buckets = [[] for _ in ko]
for w, t in words:
    bi = 0
    for i in range(len(ko)):
        if ko[i]["start"] <= t + 0.01:
            bi = i
        else:
            break
    buckets[bi].append(w)

# Light, safe ASR fixes (names / obvious mishears) — substring on the joined line.
FIX = [
    ("adinga", "Ariannita la Gringa"),
    ("when I saw problem", "when I solve a problem"),
    ("Michael penck", "Michael Penix"),
    ("fif thir Bank", "Fifth Third Bank"),
    ("fif thir", "Fifth Third"),
]

pairs = []
for i, c in enumerate(ko):
    en_line = " ".join(buckets[i]).strip()
    for a, b in FIX:
        en_line = en_line.replace(a, b)
    pairs.append({
        "i": i + 1,
        "start": fmt(c["start"]),
        "end": fmt(c["end"]),
        "en": en_line,
        "ko": c["text"],
    })

# Write aligned English SRT (timestamps identical to Korean).
def write_srt(path, key):
    out = []
    for p in pairs:
        out.append(str(p["i"]))
        out.append(f'{p["start"]} --> {p["end"]}')
        out.append(p[key] if p[key] else "")
        out.append("")
    with io.open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))

BASE = OUT_BASE
write_srt(BASE + ".en.srt", "en")
write_srt(BASE + ".ko.srt", "ko")
with io.open(BASE + ".json", "w", encoding="utf-8") as f:
    json.dump({"title": "Asking people what they do for a living (Cincinnati)", "pairs": pairs},
              f, ensure_ascii=False, indent=2)

empties = sum(1 for p in pairs if not p["en"])
print(f"KO cues: {len(ko)}  EN word-cues: {len(en)}  words: {len(words)}")
print(f"aligned pairs: {len(pairs)}  empty-English lines: {empties}")
print("--- first 6 pairs ---")
for p in pairs[:6]:
    print(f'[{p["start"]}] EN: {p["en"]}')
    print(f'           KO: {p["ko"]}')
