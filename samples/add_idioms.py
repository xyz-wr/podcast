# -*- coding: utf-8 -*-
"""기존 aligned JSON에 관용구(idioms)를 부착한다. 원본 SRT 불필요, 반복 실행 안전.
영상별 IDIOM_PHRASES는 각 JSON의 en을 읽고 큐레이션한 표현 목록이며,
각 줄의 en에 그 표현이 연속 단어열로 등장하면 그 줄의 idioms[]에 추가한다.
정규화(소문자 + 양끝 비단어문자 제거)는 앱(index.html)의 cleanTerm/idiomIdxSet과 동일."""
import re, json, io, os
BASE = os.path.dirname(os.path.abspath(__file__))


def toks(s):
    return [re.sub(r"^[^\w'-]+|[^\w'-]+$", "", w).lower() for w in (s or "").split()]


def mark_idioms(pairs, phrases):
    norm = [(p, toks(p)) for p in phrases]
    for p in pairs:
        t = toks(p.get("en", ""))
        found = [raw for raw, pw in norm
                 if pw and any(t[i:i + len(pw)] == pw for i in range(len(t) - len(pw) + 1))]
        p["idioms"] = found
    return pairs


# slug -> 큐레이션한 관용구 표현 목록 (각 영상 en에 실제 등장하는 형태)
PHRASES = {
    "restaurant-order": [
        "dress up", "get dressed up", "wait in line", "check out",
        "a big fan of", "split the bill", "go ahead", "right this way", "add up",
    ],
    "asking-living": [
        "for a living", "a book of business", "find out", "chat it up",
        "have a good time", "at once", "started out", "time and a half",
        "paid time off", "day-to-day", "try out", "go ahead",
    ],
    "experiences-part1": [
        "stay tuned", "whirlwind of a year", "pick up on", "ahead of time",
        "throw around", "once-in-a-lifetime", "coming of age", "comes to mind",
        "out of the ordinary", "knock my socks off", "knock socks off",
        "paying for the experience", "take turns", "go ahead", "low-key",
        "head on over", "take care", "comes about", "comes up",
    ],
    "ariannita-cincinnati": [
        "a book of business", "for a living",
    ],
}


def run():
    for slug, phrases in PHRASES.items():
        path = os.path.join(BASE, slug, slug + ".json")
        data = json.load(io.open(path, encoding="utf-8"))
        mark_idioms(data["pairs"], phrases)
        json.dump(data, io.open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        n = sum(1 for p in data["pairs"] if p.get("idioms"))
        hits = sum(len(p.get("idioms", [])) for p in data["pairs"])
        print(f"{slug}: {n} lines / {len(data['pairs'])} pairs · {hits} idiom hits")


if __name__ == "__main__":
    run()
