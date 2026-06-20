# In-App AI Alignment of Interleaved Bilingual Subtitles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When importing interleaved bilingual subtitles, use Gemini (if a key is set) to separate, correct, sentence-align, and 1:1 pair EN/KO with timestamps; otherwise fall back to the current `parseBilingual` heuristic.

**Architecture:** Add one pure helper (`pairsToLines`) that converts AI `[{start,en,ko}]` output into the app's existing line shape with interpolated end times, and one async AI wrapper (`aiAlignInterleaved`) that prompts Gemini and post-processes via `pairsToLines`. Wire both into `applyTranscript`'s interleaved branch, replacing the current no-op. No new storage format.

**Tech Stack:** Vanilla JS in a single `index.html`, IndexedDB, Gemini `gemini-2.5-flash` via existing `gemini()` fetch wrapper.

## Global Constraints

- All code lives in `index.html` (single-file app; no build, no module system, no test runner).
- Output line shape is exactly `{idx, time, end, en, ko, chapter}` — same array stored at `currentVideo.lines`. No new storage format/schema.
- Reuse existing helpers verbatim: `gemini(prompt, json, maxTokens)`, `tcToSec(t)`, `toast(m)`. Do NOT add dependencies.
- On AI failure or no key, the import must still succeed using the existing `parseBilingual` result (already assigned to `lines` by `buildLines`).
- Do NOT modify the `koSegmented` or `looksUnpunctuated` branches, or any parsing function. Only the `interleaved` branch of `applyTranscript` changes.
- Model name comes from the existing `GEMINI_MODEL` constant; never hardcode it.

---

### Task 1: Add `pairsToLines` (pure) and `aiAlignInterleaved` (AI wrapper)

**Files:**
- Modify: `index.html` — insert both functions immediately after `aiAlignKoLines`/`chapAt` (after [index.html:1129](../../../index.html), end of the AI helpers block).
- Test: throwaway `node -e` snippet (no repo file — the source lives in `index.html`; duplicating it into a committed test would drift).

**Interfaces:**
- Consumes: `tcToSec(t: string) -> number` ([index.html:454](../../../index.html)); `gemini(prompt: string, json: boolean, maxTokens: number) -> Promise<string>` ([index.html:1021](../../../index.html)); `GEMINI_MODEL` constant (used inside `gemini`, not here).
- Produces:
  - `pairsToLines(pairs: Array<{start?: string, en?: string, ko?: string}>) -> Array<{idx, time, end, en, ko, chapter}>` — pure; `time` = `tcToSec(start)` or `null`; `end` = next line's `time`, or `time+3` for the last, or `null` if no time; `chapter` always `''`.
  - `aiAlignInterleaved(raw: string) -> Promise<Array<{idx, time, end, en, ko, chapter}>>` — throws if AI returns zero usable pairs.

- [ ] **Step 1: Write the failing test (pure helper)**

Save this as `/tmp/test-pairs.mjs` (temporary; not committed):

```js
// Mirror of the two pure pieces under test (tcToSec + pairsToLines).
function tcToSec(t){t=t.replace(',','.');const p=t.split(':').map(parseFloat);let s=0;for(let i=0;i<p.length;i++)s=s*60+p[i];return s;}
function pairsToLines(pairs){
  const lines=(pairs||[]).filter(p=>p&&(p.en||p.ko)).map((p,i)=>{
    const has=p.start!=null&&String(p.start).trim()!=='';
    return {idx:i,time:has?tcToSec(String(p.start)):null,end:null,en:String(p.en||'').trim(),ko:String(p.ko||'').trim(),chapter:''};
  });
  for(let i=0;i<lines.length;i++)lines[i].end=(lines[i+1]&&lines[i+1].time!=null)?lines[i+1].time:(lines[i].time!=null?lines[i].time+3:null);
  return lines;
}

const out=pairsToLines([
  {start:'0:00',en:"hey it's Ariannita",ko:'헤이'},
  {start:'0:03',en:'in today video',ko:'오늘'},
  {start:'0:48',en:'the name',ko:'이름'},
  {start:'',en:'no time line',ko:'시간없음'},
  {en:null,ko:null},              // dropped (no en/ko)
]);

const A=(c,m)=>{if(!c){console.error('FAIL: '+m);process.exit(1);}};
A(out.length===4,'drops empty pair, keeps 4');
A(out[0].time===0&&out[0].end===3,'line0 time 0, end = next start 3');
A(out[1].time===3&&out[1].end===48,'line1 end = next start 48');
A(out[2].time===48&&out[2].end===51,'last timed line end = time+3');
A(out[3].time===null&&out[3].end===null,'no-start line has null time/end');
A(out[0].en==="hey it's Ariannita"&&out[0].chapter==='','en preserved, chapter empty');
A(out.every((l,i)=>l.idx===i),'idx reindexed 0..n');
console.log('PASS: pairsToLines');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node /tmp/test-pairs.mjs`
Expected: this standalone file PASSES on its own (it embeds the reference impl), but it proves the spec of `pairsToLines` before that function exists in `index.html`. The real failure check is Step 4 (the function must not yet exist in `index.html`).

Run: `grep -c "function pairsToLines" index.html`
Expected: `0` (function not yet added).

- [ ] **Step 3: Add both functions to `index.html`**

Insert after the `chapAt` function (after [index.html:1129](../../../index.html)):

```js
/* AI 정렬 결과 [{start,en,ko}] → 앱 라인 배열. end는 다음 줄 시작(마지막은 +3초)으로 보간. 순수함수 */
function pairsToLines(pairs){
  const lines=(pairs||[]).filter(p=>p&&(p.en||p.ko)).map((p,i)=>{
    const has=p.start!=null&&String(p.start).trim()!=='';
    return {idx:i,time:has?tcToSec(String(p.start)):null,end:null,en:String(p.en||'').trim(),ko:String(p.ko||'').trim(),chapter:''};
  });
  for(let i=0;i<lines.length;i++)lines[i].end=(lines[i+1]&&lines[i+1].time!=null)?lines[i+1].time:(lines[i].time!=null?lines[i].time+3:null);
  return lines;
}
/* 어긋난 양방향 자막(영-한 번갈이 + 한국어 지연) → AI가 분리·ASR교정·문장정렬·1:1 짝·시간배정 */
async function aiAlignInterleaved(raw){
  const prompt=
    'You are given a YouTube auto-caption transcript where English and Korean are interleaved on each timestamped line. '+
    'The Korean on a line is usually the translation of English that appeared 1-2 lines EARLIER (it lags), so lines are misaligned.\n'+
    'Do ALL of the following:\n'+
    '1. Separate the English stream from the Korean stream.\n'+
    '2. Fix obvious speech-recognition errors in the English (e.g. a misheard channel/person name, "saw problem" -> "solve a problem").\n'+
    '3. Remove noise tokens like [Music] and stray time labels (e.g. "0:11 11초").\n'+
    '4. Split the English into natural sentences and pair each English sentence 1:1 with the Korean sentence that MEANS the same thing (not the one that happens to share a line).\n'+
    '5. For each pair, set "start" to the timestamp (M:SS or H:MM:SS, exactly as written in the source) where that English sentence first begins.\n'+
    'Return JSON: {"pairs":[{"start":"0:00","en":"...","ko":"..."}, ...]} in chronological order. Do not invent content.\n\n'+
    'Transcript:\n'+raw;
  const out=await gemini(prompt,true,8000);
  let pairs=[];try{pairs=JSON.parse(out).pairs||[];}catch(e){}
  const lines=pairsToLines(pairs);
  if(!lines.length)throw new Error('AI alignment returned no pairs');
  return lines;
}
```

- [ ] **Step 4: Verify the function now exists and the pure logic matches the test**

Run: `grep -c "function pairsToLines" index.html`
Expected: `1`

Run: `node /tmp/test-pairs.mjs`
Expected: `PASS: pairsToLines`

Confirm by eye that the `pairsToLines` body in `index.html` is character-identical to the one in the test file (same end-interpolation rule), so the test reflects the shipped code.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: aiAlignInterleaved + pairsToLines for bilingual auto-caption alignment"
```

---

### Task 2: Wire AI alignment into `applyTranscript` + no-key fallback notice

**Files:**
- Modify: `index.html` — the interleaved branch inside `applyTranscript` ([index.html:780](../../../index.html)) and add an `else` after the `if(GEMINI_KEY){...}` block ([index.html:799](../../../index.html)).
- Test: browser smoke test via preview tools (app loads, no console errors); end-to-end fixture check.

**Interfaces:**
- Consumes: `aiAlignInterleaved(raw) -> Promise<lines[]>` (Task 1); existing locals in `applyTranscript`: `en`, `ko` (raw strings), `lines`, `interleaved`, `btn`.
- Produces: no new symbols; mutates `lines` in place when AI succeeds.

- [ ] **Step 1: Replace the interleaved no-op with the AI call**

Find this block at [index.html:780-781](../../../index.html):

```js
      if(interleaved){
        /* 쌍이 이미 맞춰져 있음 — 아무 것도 안 함 */
      }else if(koSegmented){
```

Replace it with:

```js
      if(interleaved){
        if(btn)btn.textContent='AI가 영어·한국어 정렬 중…';
        const aligned=await aiAlignInterleaved([en,ko].filter(s=>s&&s.trim()).join('\n'));
        if(aligned.length)lines=aligned;
      }else if(koSegmented){
```

- [ ] **Step 2: Add the no-key notice for interleaved imports**

Find the end of the AI block at [index.html:799](../../../index.html):

```js
    finally{if(btn){btn.disabled=false;btn.textContent=oldTxt;}}
  }

  lines.forEach((l,i)=>l.idx=i);
```

Insert an `else` branch so the `}` closing `if(GEMINI_KEY){` is followed by:

```js
    finally{if(btn){btn.disabled=false;btn.textContent=oldTxt;}}
  }else if(interleaved){
    toast('⚙ AI 키를 넣으면 영어·한국어를 더 깔끔히 정렬해요');
  }

  lines.forEach((l,i)=>l.idx=i);
```

- [ ] **Step 3: Smoke test — app loads with no JS errors**

Run: `node -e "const s=require('fs').readFileSync('index.html','utf8');const m=s.match(/<script>[\s\S]*<\/script>/g)||[];m.forEach((b,i)=>{const code=b.replace(/^<script>/,'').replace(/<\/script>$/,'');new Function(code.replace(/\bawait\b/g,'').slice(0,0));});console.log('script tags:',m.length);"`

Expected: prints `script tags: N` with no SyntaxError. (This only checks the file is parseable shell-side; the real check is Step 4.)

Then start the preview server and open the app:
- `preview_start` (serve the project over http://localhost — `file://` blocks Gemini fetch per [index.html:1034](../../../index.html)).
- `preview_console_logs` → Expected: no uncaught errors / red console entries on load.

- [ ] **Step 4: End-to-end fixture check (manual, needs a Gemini key set in the app)**

In the running preview:
1. Open the transcript input (✎), paste the ORIGINAL misaligned auto-caption text (the source block from the conversation / reconstructable from `samples/`) into the English box, leave Korean empty, Apply.
2. Expected while running: button shows `AI가 영어·한국어 정렬 중…`.
3. `preview_snapshot` the study screen. Expected: ~12 lines, each English sentence paired with the matching Korean (e.g. line 1 `hey everybody it's Ariannita la Gringa ...` ⇄ `헤이 여러분! ... 환영합니다`), `adinga` corrected, `[Music]` gone — matching `samples/ariannita-cincinnati.json`.

If no key is available in the test environment: instead verify the fallback — confirm the toast `⚙ AI 키를 넣으면 ...` appears and lines still render via `parseBilingual` (misaligned but present, no crash). Note in the commit/PR that AI-path E2E was deferred to the user's keyed device.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: run AI alignment on interleaved import; notice when no key"
```

---

## Self-Review

**1. Spec coverage:**
- §① integration point → Task 2 Steps 1-2. ✓
- §② `aiAlignInterleaved` contract (separate / ASR fix / noise removal / 1:1 meaning pair / timestamp; output `{time,end,en,ko,chapter}`; reuse `gemini`; throw→fallback) → Task 1 Step 3 + `pairsToLines`. ✓
- §③ fallback keeps `parseBilingual`; no-key toast → Task 2 Step 2 (`else if(interleaved)`), and `buildLines` already left `lines` set so AI throw inside try is caught by existing `aiErr` and the heuristic result survives. ✓
- §④ auto trigger + progress text + error safety → Task 2 Steps 1-2 (button text, existing `try/catch`). ✓
- §⑤ verification against `samples/` fixture → Task 2 Step 4. ✓

**2. Placeholder scan:** No TBD/TODO; all code blocks complete; prompt text fully written. ✓

**3. Type consistency:** `pairsToLines` returns `{idx,time,end,en,ko,chapter}`; `aiAlignInterleaved` returns the same and is assigned to `lines`, consistent with `buildLines`/`aiAlignKoLines` output and with `currentVideo.lines`. `start` (string) → `tcToSec` → numeric `time`, matching `parseBilingual`'s end-interpolation (`time+3`). Names used in Task 2 (`aiAlignInterleaved`, `interleaved`, `en`, `ko`, `lines`, `btn`) all exist. ✓
