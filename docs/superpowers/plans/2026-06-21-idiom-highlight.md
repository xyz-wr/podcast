# 관용구 하이라이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스킬로 만든 aligned JSON의 각 쌍에 담긴 `idioms[]`를 앱이 읽어 해당 영어 단어에 밑줄 하이라이트하고, 기존 샘플 4개에 관용구를 백필한다.

**Architecture:** 관용구 감지는 빌드 시점에 한다. 영상별로 큐레이션한 관용구 표현 목록을 각 줄의 `en`에 매칭해 per-pair `idioms[]`로 JSON에 박는다(`mark_idioms`). 앱은 `parseAlignedJson`에서 `idioms`를 보존하고, `renderTranscript`에서 동일 정규화로 표현→토큰 매칭(`idiomIdxSet`)해 `.word.idiom` 클래스를 붙인다. 단어 탭/추가는 불변.

**Tech Stack:** 바닐라 JS + IndexedDB + YouTube IFrame (단일 `index.html`); Python 빌드/패치 스크립트(`samples/`). 테스트 러너 없음 → 앱은 `preview_*` 브라우저 도구로, Python은 실행 출력으로 검증.

## Global Constraints

- 앱 변경은 `C:\Users\pponi13468\Desktop\박미정\podcast\index.html` 한 파일.
- 단어 탭/선택/추가(`toggleWord`) 동작 **변경 금지** — 관용구는 시각 표시만.
- 관용구는 **스킬 JSON에만** 적용. `idioms` 없는 영상(raw SRT)은 하이라이트 0이어야 함(하위 호환).
- 토큰/표현 정규화는 앱·Python 모두 동일: 소문자 + 양끝 비단어문자 제거(`cleanTerm` 동등) + 공백 단어열.
- 매칭 실패한 표현은 조용히 무시(에러 금지).
- 배포: `master` push → Netlify 자동 배포.

---

### Task 1: 앱 — idioms 보존 + 토큰 매칭 + 하이라이트

**Files:**
- Modify: `index.html` — `parseAlignedJson`(~1390-1397), `renderTranscript`(~876-893), CSS(~112-115)

**Interfaces:**
- Produces:
  - `parseAlignedJson` 라인 객체에 `idioms: string[]`.
  - `idiomIdxSet(tokens, idioms) -> Set<number>` — 하이라이트할 토큰 인덱스 집합.
  - `.word.idiom` CSS 클래스.

- [ ] **Step 1: `parseAlignedJson`에 idioms 매핑 추가**

`index.html`의 라인 매핑 객체에서 `chapter:String(p.chapter||'').trim()` 다음에 콤마+한 줄 추가:

```js
    chapter:String(p.chapter||'').trim(),
    idioms:Array.isArray(p.idioms)?p.idioms.filter(x=>typeof x==='string'&&x.trim()):[]
```

- [ ] **Step 2: `idiomIdxSet` 헬퍼 추가**

`renderTranscript` 함수 **바로 위**에 추가:

```js
function idiomIdxSet(tokens,idioms){const set=new Set();
  if(!idioms||!idioms.length)return set;
  const norm=tokens.map(t=>cleanTerm(t).toLowerCase());
  for(const ph of idioms){const pw=String(ph).toLowerCase().split(/\s+/).map(w=>cleanTerm(w)).filter(Boolean);
    if(!pw.length)continue;
    for(let i=0;i+pw.length<=norm.length;i++){let ok=true;
      for(let j=0;j<pw.length;j++){if(norm[i+j]!==pw[j]){ok=false;break;}}
      if(ok)for(let j=0;j<pw.length;j++)set.add(i+j);}}
  return set;}
```

- [ ] **Step 3: `renderTranscript`에서 클래스 부여**

`const tks=wordsOf(ln.en||ln.ko);` 다음 줄에 idiom 집합 계산을 추가하고, word span 생성부에 클래스를 끼운다. 해당 블록을 다음으로 교체:

```js
    const tks=wordsOf(ln.en||ln.ko);
    const idSet=idiomIdxSet(tks,ln.idioms);
    let words='';tks.forEach((w,i)=>{const mute=/^\(.*\)$/.test(w);const sv=saved.has(cleanTerm(w).toLowerCase());const id=idSet.has(i)?' idiom':'';
      words+=`<span class="word${mute?' mute':''}${sv?' saved':''}${id}" data-i="${i}">${esc(w)}</span> `;});
```

- [ ] **Step 4: CSS `.word.idiom` 추가**

`index.html`의 `.word.saved{...}` 줄 다음에 추가:

```css
  .word.idiom{text-decoration:underline;text-decoration-color:var(--amber-deep);text-decoration-thickness:2px;text-underline-offset:2px;}
```

- [ ] **Step 5: 검증 (브라우저)**

`preview_start`(static) 후, idioms 포함 JSON을 직접 주입해 렌더 확인:

```js
// preview_eval
(()=>{currentVideo={id:'idtest',youtubeId:'x',title:'T',lines:[
  {idx:0,time:1,en:"it's a piece of cake once you get the hang of it",ko:'요령만 익히면 식은 죽 먹기',idioms:["a piece of cake","get the hang of it"]},
  {idx:1,time:5,en:"no idioms in this line at all",ko:'이 줄엔 관용구 없음',idioms:[]}
]};showScreen('study');renderTranscript();
 const r=[...document.querySelectorAll('.tline[data-i="0"] .word')].map(w=>({t:w.textContent,idiom:w.classList.contains('idiom')}));
 const line1=[...document.querySelectorAll('.tline[data-i="1"] .word')].filter(w=>w.classList.contains('idiom')).length;
 currentVideo=null;showScreen('library');
 return {line0:r,line1IdiomCount:line1};})()
```

Expected: line0에서 `a/piece/of/cake` 와 `get/the/hang/of/it` 토큰이 `idiom:true`, 나머지 false. `line1IdiomCount`=0. `preview_console_logs`(error) 비어 있음.

- [ ] **Step 6: 커밋**

```bash
printf '<msg>' > .git/COMMIT_MSG_TMP.txt   # "feat(idiom): highlight build-marked idioms in transcript"
git add index.html && git commit -F .git/COMMIT_MSG_TMP.txt && rm -f .git/COMMIT_MSG_TMP.txt
```

---

### Task 2: 백필 스크립트 + 기존 샘플 4개 패치

**Files:**
- Create: `samples/add_idioms.py`
- Modify(생성물): `samples/<slug>/<slug>.json` 4개

**Interfaces:**
- Consumes: 각 `samples/<slug>/<slug>.json` (pairs 배열).
- Produces: 각 pair에 `idioms[]` 부착된 동일 JSON.

- [ ] **Step 1: `samples/add_idioms.py` 작성**

```python
# -*- coding: utf-8 -*-
"""기존 aligned JSON에 관용구(idioms)를 부착한다. 원본 SRT 불필요, 반복 실행 안전.
영상별 IDIOM_PHRASES는 작성자가 각 JSON의 en을 읽고 큐레이션한다."""
import re, json, io, os
BASE = os.path.dirname(os.path.abspath(__file__))

def toks(s):
    return [re.sub(r"^[^\w'-]+|[^\w'-]+$", "", w).lower() for w in (s or "").split()]

def mark_idioms(pairs, phrases):
    norm = [(p, toks(p)) for p in phrases]
    for p in pairs:
        t = toks(p.get("en", ""))
        found = [raw for raw, pw in norm
                 if pw and any(t[i:i+len(pw)] == pw for i in range(len(t)-len(pw)+1))]
        p["idioms"] = found
    return pairs

# slug -> 큐레이션 관용구 표현 목록 (구현 시 각 JSON의 en을 읽고 채움)
PHRASES = {
    "restaurant-order": [],
    "asking-living": [],
    "experiences-part1": [],
    "ariannita-cincinnati": [],
}

def run():
    for slug, phrases in PHRASES.items():
        path = os.path.join(BASE, slug, slug + ".json")
        data = json.load(io.open(path, encoding="utf-8"))
        mark_idioms(data["pairs"], phrases)
        json.dump(data, io.open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        n = sum(1 for p in data["pairs"] if p.get("idioms"))
        print(f"{slug}: {n} lines with idioms / {len(data['pairs'])}")

if __name__ == "__main__":
    run()
```

- [ ] **Step 2: 각 영상 관용구 큐레이션**

각 `samples/<slug>/<slug>.json`의 `en`들을 읽어 실제 등장하는 관용구를 골라 `PHRASES[slug]`에 채운다. 표현은 **JSON의 en에 나오는 형태 그대로**(소문자 매칭되지만 가독성 위해 원형). 예) restaurant-order: `"what can I get for you"`, `"are you ready to order"` 류 중 관용적 표현만. (코드가 아닌 큐레이션 작업 — Read로 en 확인 후 입력)

- [ ] **Step 3: 실행 + 검증**

```bash
python samples/add_idioms.py
```
Expected: 4개 영상 각각 `<slug>: N lines with idioms / M` 출력(N>0). JSON에 `"idioms"` 필드가 들어갔는지 확인:
```bash
python -c "import json,io;d=json.load(io.open(r'samples/restaurant-order/restaurant-order.json',encoding='utf-8'));print([p for p in d['pairs'] if p.get('idioms')][:2])"
```

- [ ] **Step 4: 앱에서 실제 import 검증 (브라우저)**

`preview_eval`로 restaurant-order.json을 fetch→`parseAlignedJson`→임시 currentVideo로 렌더해 idiom 클래스가 1개 이상 생기는지 확인:

```js
(async()=>{const raw=await (await fetch('/samples/restaurant-order/restaurant-order.json')).text();
 const lines=parseAlignedJson(raw); if(!lines)return {err:'parse fail'};
 const withId=lines.filter(l=>l.idioms&&l.idioms.length).length;
 currentVideo={id:'x',youtubeId:'x',title:'t',lines};showScreen('study');renderTranscript();
 const cnt=document.querySelectorAll('.word.idiom').length;currentVideo=null;showScreen('library');
 return {linesWithIdioms:withId, idiomWordSpans:cnt};})()
```
Expected: `linesWithIdioms>0`, `idiomWordSpans>0`.

- [ ] **Step 5: 커밋**

```bash
printf '<msg>' > .git/COMMIT_MSG_TMP.txt   # "feat(samples): backfill idioms into 4 sample videos"
git add samples/add_idioms.py samples/*/*.json && git commit -F .git/COMMIT_MSG_TMP.txt && rm -f .git/COMMIT_MSG_TMP.txt
```

---

### Task 3: 스킬 문서 업데이트 (subtitle-to-aligned-json)

**Files:**
- Modify: `C:\Users\pponi13468\.claude\skills\subtitle-to-aligned-json\SKILL.md`

**Interfaces:** consumes Task 2의 `mark_idioms` 패턴.

- [ ] **Step 1: 출력 형식 예시에 idioms 추가**

`## Output Format`의 예시 pair에 `idioms` 필드 추가:

```json
    { "i": 1, "start": "00:00:01,291", "end": "00:00:04,500",
      "en": "hey everybody", "ko": "여러분 안녕하세요", "idioms": [] }
```

- [ ] **Step 2: 빌드 템플릿에 IDIOM_PHRASES + mark_idioms 추가**

`## Build Script Template`의 스켈레톤에서 pairs 생성 다음에 추가하도록 본문 수정:

```python
IDIOM_PHRASES = [ ... ]   # 이 영상에 등장하는 관용구(작성자 큐레이션)
def _t(s):
    import re; return [re.sub(r"^[^\w'-]+|[^\w'-]+$","",w).lower() for w in (s or "").split()]
def mark_idioms(pairs, phrases):
    norm=[(p,_t(p)) for p in phrases]
    for p in pairs:
        t=_t(p["en"]); p["idioms"]=[raw for raw,pw in norm if pw and any(t[i:i+len(pw)]==pw for i in range(len(t)-len(pw)+1))]
mark_idioms(pairs, IDIOM_PHRASES)
```

- [ ] **Step 3: Common Mistakes / 흐름 설명에 한 줄 추가**

`## Pair Flow`와 `## English-only Flow`에 "관용구를 큐레이션해 `mark_idioms`로 부착" 단계를 명시하고, Common Mistakes에 추가:

```
- ❌ 관용구를 줄별로 손 인덱싱 → 대신 영상별 표현 목록 + `mark_idioms`로 자동 부착(앱 매칭과 동일).
```

- [ ] **Step 4: 커밋 + 푸시(배포)**

```bash
cd "C:/Users/pponi13468/Desktop/박미정/podcast"
printf '<msg>' > .git/COMMIT_MSG_TMP.txt   # "docs(skill): emit idioms[] via curated phrases + mark_idioms"
git add -A && git commit -F .git/COMMIT_MSG_TMP.txt && rm -f .git/COMMIT_MSG_TMP.txt
git push
```

(주: SKILL.md는 git 저장소 밖(`~/.claude/skills`)이라 커밋 대상이 아님 — 이 단계 커밋/푸시는 앱·샘플 변경의 최종 배포용이며, SKILL.md 편집은 파일 저장으로 완료.)

---

## Self-Review

- **Spec coverage:** 데이터 형식=T1·T2, `parseAlignedJson`=T1, `renderTranscript`/`idiomIdxSet`=T1, CSS=T1, `mark_idioms`=T2/T3, 스킬 문서=T3, 백필 4개=T2. 전 항목 매핑됨.
- **Placeholder scan:** 코드 단계는 실제 코드 포함. `PHRASES`/`IDIOM_PHRASES`의 표현 목록은 "큐레이션 작업"으로, JSON의 en을 읽고 채우는 창작 단계(기계적 placeholder 아님). 커밋 메시지 `<msg>`는 각 단계 주석에 실제 문구 명시.
- **Type consistency:** `idioms:string[]`, `idiomIdxSet(tokens,idioms)->Set<number>`, `mark_idioms(pairs,phrases)`, `toks`/`_t` 정규화 동일 규칙(앱 `cleanTerm`과 Python 정규식 동등). 일관.
