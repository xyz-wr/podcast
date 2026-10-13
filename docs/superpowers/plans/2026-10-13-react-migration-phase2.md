# React 이관 Phase 2 (화면 구조 + 퀴즈) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이관하지 않기로 한 화면(일기·작문)의 추출물을 정리하고, 화면 틀을 legacy 구조(`<main>` 안/밖, `screen-…` id)로 맞춘 뒤, 기본 탭인 **영작 퀴즈**를 React로 옮긴다.

**Architecture:** 퀴즈 로직은 세 층으로 나눈다. `model.ts`는 legacy 순수 함수(`qGrade`, `qRefill` 등)를 감싸는 타입 있는 헬퍼와 저장 형식(`elab_quiz_v1`)이다. `store.ts`는 Zustand 스토어로 legacy 모듈의 상태 변수(`qs`, `mode`, `rev`, `qview`, `cur`, `lis`, `lisRate`)와 동작 함수를 그대로 옮기며, `qs`가 바뀔 때마다 저장한다. `views.tsx`와 `parts.tsx`는 legacy HTML 문자열을 같은 class 이름의 JSX로 옮긴다. TTS는 퀴즈·회화·설정이 함께 쓰므로 `src/speech/tts.ts`로 분리한다.

**Tech Stack:** React 19, Zustand 5, Vitest + Testing Library, legacy CSS(`quiz.css`).

**공통 규칙:** [로드맵](2026-10-13-react-migration-roadmap.md)의 공통 규칙을 따른다. 저장 키 `elab_quiz_v1`, `elab_voice`의 이름과 형식을 바꾸지 않는다.

**범위 밖:** 회화 탭에서 표현 하나를 퀴즈로 푸는 `runExpression`(표현 모드)은 회화를 옮기는 Phase 3에서 추가한다. 설정 화면의 목소리 선택 UI는 Phase 6이다. `tts.ts`는 그때 쓸 `enVoiceList`, `setEnVoice`를 미리 제공한다.

**legacy 참고 위치** (`legacy/index.html`, 줄 번호는 참고용): 퀴즈 모듈 `<script id="quiz-module">` 1081–1772행. 상태는 `/* ---------- 상태 ---------- */`, 진행은 `/* ---------- 세션 진행 ---------- */`, 화면은 `/* ---------- 화면 ---------- */` 아래. 퀴즈 화면 틀은 `<section id="screen-wquiz">`(1077행)이고 `<main>`(243–948행) **바깥**에 있다.

---

## File Structure

| 파일 | 역할 |
|---|---|
| `scripts/extract-legacy.mjs` | 일기 데이터, 일기·작문 CSS 추출 제거 |
| `src/storage/keys.ts` | `LS_KEYS`에서 `diary`, `write` 제거 |
| `src/app/screens.tsx` | 탭 → legacy 화면 id, `<main>` 안/밖, 그릴 컴포넌트 |
| `src/app/App.tsx` | `<main>` + 화면 section 구조 |
| `src/speech/tts.ts` | 영어 음성 선택(`elab_voice`), `speak`, `whenVoicesReady` |
| `src/features/quiz/model.ts` | 문장 풀, 조회, 채점, 저장 형식, 라운드 만들기, 듣기 타일 |
| `src/features/quiz/store.ts` | 퀴즈 상태와 동작(Zustand), 자동 저장 |
| `src/features/quiz/parts.tsx` | 머리말, 진행 점, 단계 표시, 발음 버튼, 표현 강조, 내 답 흐리기 |
| `src/features/quiz/views.tsx` | 문제·채점·듣기·라운드 결과·완료·완료함 화면 |
| `src/features/quiz/QuizScreen.tsx` | 퀴즈 탭 진입점 |

---

### Task 1: 이관하지 않는 화면(일기·작문) 정리

2026-10-13 결정: 일기·작문·개선·스트릭은 legacy에서 들어갈 경로가 없는 화면이라 옮기지 않는다. 브라우저에 남은 기록(`eldiary_v1`, `engWriteB1_v1`)은 건드리지 않는다. 개선·스트릭은 `base.css`와 공통 스크립트에 섞여 있어 이 Task에서는 다루지 않는다.

**Files:**
- Modify: `scripts/extract-legacy.mjs`, `src/data/data.test.ts`, `src/storage/keys.ts`, `src/storage/keys.test.ts`
- Delete: `src/data/diary.json`, `src/styles/legacy/diary.css`, `src/styles/legacy/write.css`

- [ ] **Step 1: 테스트를 먼저 바꾼다**

`src/storage/keys.test.ts`의 `LS_KEYS` 기대값을 아래로 바꾼다.

```ts
  expect(LS_KEYS).toEqual({
    tab: 'elab_tab', voice: 'elab_voice', progress: 'elab_progress_v1',
    quiz: 'elab_quiz_v1', voca: 'elab_voca_v1',
  });
```

`src/data/data.test.ts`에서 `import diary from './diary.json';` 줄과 `it('일기 데이터 제목', …)` 테스트 전체를 지운다.

Run: `npx vitest run src/storage/keys`
Expected: FAIL (`LS_KEYS`에 아직 `diary`, `write`가 있음)

- [ ] **Step 2: `src/storage/keys.ts`의 `LS_KEYS` 교체**

```ts
export const LS_KEYS = {
  tab: 'elab_tab',               // 마지막 탭 (JSON 아님, 문자열 그대로)
  voice: 'elab_voice',           // TTS 음성
  progress: 'elab_progress_v1',  // 회화 진도
  quiz: 'elab_quiz_v1',
  voca: 'elab_voca_v1',
  // eldiary_v1, engWriteB1_v1 은 이관하지 않는 화면(일기·작문)의 기록이다. 읽지도 지우지도 않는다.
} as const;
```

- [ ] **Step 3: 추출 스크립트 수정**

`scripts/extract-legacy.mjs`에서
1. `const diary = …` 줄과 `write('src/data/diary.json', …)` 줄을 지운다.
2. CSS 부분을 아래로 바꾼다.

```js
// 3) CSS: id 없는 첫 <style> → base.css, <style id="xxx-style"> → xxx.css
//    일기·작문은 이관하지 않는다 (2026-10-13 결정).
const DROPPED = new Set(['diary', 'write']);
const css = [...HTML.matchAll(/<style(?: id="([\w-]+)")?>([\s\S]*?)<\/style>/g)];
const names = [];
for(const [, id, body] of css){
  const name = id ? id.replace(/-style$/, '') : 'base';
  if(DROPPED.has(name)) continue;
  write(`src/styles/legacy/${name}.css`, `/* 자동 생성: npm run extract — 원본 legacy/index.html */\n${body.trim()}\n`);
  names.push(name);
}
```

- [ ] **Step 4: 생성물 정리 후 재생성**

```bash
git rm -q src/data/diary.json src/styles/legacy/diary.css src/styles/legacy/write.css
npm run extract
cat src/styles/legacy/index.ts
```

Expected: `index.ts`에 `base`, `conv`, `quiz`, `video`, `voca` 5개만 import. `git status`에서 `conv.json`, `quiz-core.js`, `voca-core.js`, 남은 CSS는 변경 없음.

- [ ] **Step 5: 테스트·타입 확인 후 커밋**

Run: `npm test` → 101 passed. `npx tsc --noEmit` → 출력 없음.

```bash
git add -A scripts src/data src/styles src/storage
git commit -m "chore: 이관하지 않는 일기·작문 화면의 추출물과 저장 키 제거"
```

---

### Task 2: 화면 틀을 legacy 구조로

legacy는 일부 화면(라이브러리, 회화, 보카, 더보기 등)을 `<main>` 안에, 퀴즈·영상은 `<main>` 밖에 둔다. `base.css`의 `main`(최대 폭 560px, 탭바 높이만큼 아래 여백)과 `#screen-…` 선택자가 똑같이 적용되도록 구조를 맞춘다. `<main>`은 legacy처럼 항상 그린다.

**Files:**
- Create: `src/app/screens.tsx`
- Modify: `src/app/App.tsx`, `src/app/App.test.tsx`

- [ ] **Step 1: 실패하는 테스트 추가** — `src/app/App.test.tsx` 끝에 추가

```tsx
it('legacy처럼 퀴즈 화면은 <main> 밖, 보카 화면은 <main> 안에 그린다', () => {
  start('wquiz');
  const quiz = screen.getByTestId('screen');
  expect(quiz.id).toBe('screen-wquiz');
  expect(quiz.closest('main')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /보카/ }));
  const voca = screen.getByTestId('screen');
  expect(voca.id).toBe('screen-voca');
  expect(voca.closest('main')).not.toBeNull();
});

it('학습 탭은 legacy 화면 id(screen-library)를 쓴다', () => {
  start('learn');
  expect(screen.getByTestId('screen').id).toBe('screen-library');
});
```

Run: `npx vitest run src/app` → FAIL (`id`가 빈 문자열)

- [ ] **Step 2: `src/app/screens.tsx`**

Task 6에서 `wquiz`에 `render`를 붙인다. 지금은 모두 자리 표시.

```tsx
import type { ReactNode } from 'react';
import type { TabId } from './tabs';

export interface ScreenDef {
  id: string;          // legacy <section id="…">
  inMain: boolean;     // legacy 에서 <main> 안에 있는가
  render?: () => ReactNode;
}

// legacy 의 화면 id 와 위치를 그대로 따른다. 탭 id 와 화면 id 가 다른 경우가 있다 (learn → screen-library).
export const SCREENS: Record<TabId, ScreenDef> = {
  voca: { id: 'screen-voca', inMain: true },
  conv: { id: 'screen-conv', inMain: true },
  wquiz: { id: 'screen-wquiz', inMain: false },
  learn: { id: 'screen-library', inMain: true },
  video: { id: 'screen-video', inMain: false },
  settings: { id: 'screen-settings', inMain: true },
};
```

- [ ] **Step 3: `src/app/App.tsx` 교체**

```tsx
import { useAppStore } from '../store/app';
import { SCREENS } from './screens';
import { TabBar } from './TabBar';
import { tabLabel } from './tabs';

export function App() {
  const tab = useAppStore(s => s.tab);
  const def = SCREENS[tab];
  const section = (
    <section id={def.id} className="screen active" data-testid="screen">
      {def.render ? def.render() : (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--ink-soft)' }}>
          {tabLabel(tab)} 화면은 이관 중입니다.
        </div>
      )}
    </section>
  );
  // legacy 는 <main> 을 항상 두고, 퀴즈·영상 화면만 그 바깥에 둔다.
  return (
    <>
      <main>{def.inMain && section}</main>
      {!def.inMain && section}
      <TabBar />
    </>
  );
}
```

- [ ] **Step 4: 통과 확인 후 커밋**

Run: `npx vitest run src/app` → 7 passed. `npm test` → 103 passed.

```bash
git add src/app
git commit -m "feat(app): 화면 틀을 legacy 구조(<main> 안/밖, screen- id)로 맞춤"
```

---

### Task 3: TTS 모듈

legacy `quiz-module`의 `enVoiceList`, `pickVoice`, `setEnVoice`, `speak`, `whenVoicesReady`를 옮긴다. 음성 순위는 이미 추출된 `rankVoices`를 쓴다.

**Files:**
- Create: `src/speech/tts.ts`, `src/speech/tts.test.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: 테스트** — `src/speech/tts.test.ts`

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { currentVoice, enVoiceList, initTts, resetTtsForTests, setEnVoice, speak, whenVoicesReady } from './tts';

type V = { name: string; lang: string; localService?: boolean };
let voices: V[];
let listeners: Record<string, Array<() => void>>;
const spoken: Array<{ text: string; lang: string; rate: number; voice: unknown }> = [];

class FakeUtterance {
  text: string; lang = ''; rate = 1; pitch = 1; voice: unknown = null;
  constructor(text: string){ this.text = text; }
}

beforeEach(() => {
  localStorage.clear();
  resetTtsForTests();
  spoken.length = 0;
  listeners = {};
  voices = [
    { name: 'Microsoft David - English (United States)', lang: 'en-US' },
    { name: 'Google US English', lang: 'en-US' },
    { name: 'Google 한국의', lang: 'ko-KR' },
  ];
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => voices,
    cancel: vi.fn(),
    speak: (u: FakeUtterance) => spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice }),
    addEventListener: (type: string, fn: () => void) => { (listeners[type] ||= []).push(fn); },
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('영어 음성만, 품질 순으로 고른다', () => {
  expect(enVoiceList().map(v => v.name)).toEqual(['Google US English', 'Microsoft David - English (United States)']);
  initTts();
  expect(currentVoice()?.name).toBe('Google US English');
});

it('elab_voice 에 저장된 음성을 우선한다', () => {
  localStorage.setItem('elab_voice', 'Microsoft David - English (United States)');
  initTts();
  expect(currentVoice()?.name).toBe('Microsoft David - English (United States)');
});

it('setEnVoice 는 목록에 있는 음성만 저장한다', () => {
  setEnVoice('없는 음성');
  expect(localStorage.getItem('elab_voice')).toBeNull();
  setEnVoice('Microsoft David - English (United States)');
  expect(localStorage.getItem('elab_voice')).toBe('Microsoft David - English (United States)');
  expect(currentVoice()?.name).toBe('Microsoft David - English (United States)');
});

it('speak: 고른 음성·언어·속도로 말한다', () => {
  speak('Hello there.', 0.75);
  expect(spoken).toEqual([{ text: 'Hello there.', lang: 'en-US', rate: 0.75, voice: voices[1] }]);
});

it('whenVoicesReady: 목록이 비어 있으면 voiceschanged 를 기다린다', () => {
  const real = voices; voices = [];
  const cb = vi.fn();
  whenVoicesReady(cb);
  expect(cb).not.toHaveBeenCalled();
  voices = real;
  listeners.voiceschanged.forEach(f => f());
  expect(cb).toHaveBeenCalledTimes(1);
  expect(currentVoice()?.name).toBe('Google US English');
});

it('whenVoicesReady: 이벤트가 안 와도 1.5초 뒤 한 번만 실행', () => {
  vi.useFakeTimers();
  voices = [];
  const cb = vi.fn();
  whenVoicesReady(cb);
  vi.advanceTimersByTime(1500);
  listeners.voiceschanged.forEach(f => f());
  expect(cb).toHaveBeenCalledTimes(1);
});
```

Run: `npx vitest run src/speech` → FAIL (모듈 없음)

- [ ] **Step 2: `src/speech/tts.ts`**

```ts
import { rankVoices } from '../core/legacy/quiz-core.js';
import { LS_KEYS } from '../storage/keys';
import { lsGetRaw, lsSetRaw } from '../storage/local';

// legacy quiz-module 의 음성 처리. 퀴즈·회화·설정(목소리 선택)이 함께 쓴다.
let enVoice: SpeechSynthesisVoice | null = null;

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

export function enVoiceList(): SpeechSynthesisVoice[] {
  const s = synth();
  return s ? (rankVoices(s.getVoices()) as SpeechSynthesisVoice[]) : [];
}

export function pickVoice(): void {
  const ranked = enVoiceList();
  if(!ranked.length){ enVoice = null; return; }
  const saved = lsGetRaw(LS_KEYS.voice);
  enVoice = (saved && ranked.find(v => v.name === saved)) || ranked[0];
}

export const currentVoice = (): SpeechSynthesisVoice | null => enVoice;

export function setEnVoice(name: string): void {
  const v = enVoiceList().find(x => x.name === name);
  if(!v) return;
  enVoice = v;
  lsSetRaw(LS_KEYS.voice, name);
}

export function speak(text: string, rate = 1): void {
  const s = synth();
  if(!s) return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if(!enVoice) pickVoice();
  u.lang = enVoice ? enVoice.lang : 'en-US';
  u.rate = rate;
  u.pitch = 1;
  if(enVoice){ try { u.voice = enVoice; } catch { enVoice = null; } }
  s.speak(u);
}

// 음성 목록은 비동기로 로드된다. 목록보다 먼저 말하면 영어 대신 기기 기본 음성이 잡히므로 기다린다.
export function whenVoicesReady(cb: () => void): void {
  const s = synth();
  if(!s) return cb();
  if(s.getVoices().length){ if(!enVoice) pickVoice(); return cb(); }
  let fired = false;
  const go = () => { if(fired) return; fired = true; pickVoice(); cb(); };
  s.addEventListener('voiceschanged', go, { once: true });
  setTimeout(go, 1500);
}

export function initTts(): void {
  const s = synth();
  if(!s) return;
  pickVoice();
  s.addEventListener('voiceschanged', pickVoice);
}

export function resetTtsForTests(): void { enVoice = null; }
```

Run: `npx vitest run src/speech` → 6 passed

- [ ] **Step 3: 시작할 때 음성 준비** — `src/main.tsx`의 `void startSync();` 다음 줄에 추가하고 import를 넣는다.

```tsx
import { initTts } from './speech/tts';
```

```tsx
initTts();
```

- [ ] **Step 4: 확인 후 커밋**

Run: `npm test` → 109 passed. `npx tsc --noEmit` → 출력 없음.

```bash
git add src/speech src/main.tsx
git commit -m "feat(speech): 영어 음성 선택·말하기 모듈 이관 (elab_voice 유지)"
```

---

### Task 4: 퀴즈 모델 (조회, 채점, 저장 형식, 라운드, 듣기 타일)

**Files:**
- Create: `src/features/quiz/model.ts`, `src/features/quiz/model.test.ts`

- [ ] **Step 1: 테스트** — `src/features/quiz/model.test.ts`

```ts
import { beforeEach, expect, it } from 'vitest';
import { POOL, grade, loadMain, lookup, newRound, nextRate, pickTile, saveMain, startListen, wrongIds } from './model';

beforeEach(() => localStorage.clear());

const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

it('문장 풀과 조회 (id = 폴더|카드|시제)', () => {
  expect(POOL.length).toBeGreaterThan(100);
  const it0 = lookup(POOL[0])!;
  expect(it0.id).toBe(POOL[0]);
  expect(['present', 'past', 'future', 'progressive']).toContain(it0.tense);
  expect(lookup('없음|0|past')).toBeNull();
});

it('채점: 모범 답안 그대로면 정답, 빈 답이면 오답', () => {
  const it0 = lookup(POOL[0])!;
  expect(grade(it0.en, it0).ok).toBe(true);
  expect(grade('', it0)).toMatchObject({ ok: false, ratio: 0, hasExpr: false });
});

it('legacy 가 저장한 elab_quiz_v1 을 그대로 읽는다', () => {
  localStorage.setItem('elab_quiz_v1', JSON.stringify({
    completed: { a: { wrong: 1 } }, wrong: { b: 2 }, queue: ['c'], round: 3, cursor: 1, results: [{ id: 'c', ok: true, corrected: false }],
  }));
  expect(loadMain()).toEqual({
    completed: { a: { wrong: 1 } }, wrong: { b: 2 }, queue: ['c'], round: 3, cursor: 1, results: [{ id: 'c', ok: true, corrected: false }],
  });
});

it('없거나 깨졌거나 null 이면 빈 상태', () => {
  const blank = { completed: {}, wrong: {}, queue: [], round: 1, cursor: 0, results: [] };
  expect(loadMain()).toEqual(blank);
  localStorage.setItem('elab_quiz_v1', '{oops');
  expect(loadMain()).toEqual(blank);
  localStorage.setItem('elab_quiz_v1', 'null');
  expect(loadMain()).toEqual(blank);
});

it('저장은 legacy 와 같은 JSON', () => {
  const s = { completed: {}, wrong: { x: 1 }, queue: ['y'], round: 2, cursor: 0, results: [] };
  saveMain(s);
  expect(JSON.parse(localStorage.getItem('elab_quiz_v1')!)).toEqual(s);
});

it('newRound: 완료·통과한 문장을 빼고 5개로 채운 뒤 섞는다', () => {
  const done = { [POOL[0]]: { wrong: 0 } };
  const r = newRound({ queue: [POOL[0], POOL[1]], round: 1, cursor: 3, results: [{ id: 'z', ok: true, corrected: false }] }, done, POOL, seq(0));
  expect(r.queue).toHaveLength(5);
  expect(r.queue).toContain(POOL[1]);
  expect(r.queue).not.toContain(POOL[0]);
  expect(r).toMatchObject({ cursor: 0, results: [], round: 1 });
});

it('wrongIds: 완료한 문장 중 한 번이라도 틀린 것', () => {
  expect(wrongIds({ completed: { a: { wrong: 0 }, b: { wrong: 2 } }, wrong: {}, queue: [], round: 1, cursor: 0, results: [] })).toEqual(['b']);
});

it('듣기 타일: 문장부호를 떼고, 틀린 타일은 bad, 순서대로 다 고르면 done', () => {
  const l = startListen('Hi, there you go!', seq(0));
  expect(l.words).toEqual(['Hi', 'there', 'you', 'go']);
  expect([...l.order].sort()).toEqual([0, 1, 2, 3]);
  const bad = pickTile(l, 2);
  expect(bad).toMatchObject({ bad: 2, picked: [] });
  let s = l;
  for(const i of [0, 1, 2, 3]) s = pickTile(s, i);
  expect(s).toMatchObject({ done: true, picked: [0, 1, 2, 3], bad: -1 });
  expect(pickTile(s, 0)).toBe(s);
});

it('같은 단어가 여러 번 나오면 글자로 비교한다', () => {
  const l = startListen('go go now', seq(0));
  expect(pickTile(l, 1).picked).toEqual([1]);   // 두 번째 go 를 먼저 골라도 맞음
});

it('듣기 속도는 1 → 0.75 → 0.5 → 1', () => {
  expect([nextRate(1), nextRate(0.75), nextRate(0.5)]).toEqual([0.75, 0.5, 1]);
});
```

Run: `npx vitest run src/features/quiz/model` → FAIL (모듈 없음)

- [ ] **Step 2: `src/features/quiz/model.ts`**

```ts
import { qBuildPool, qGrade, qLookup, qRefill, qShuffle, qzWords } from '../../core/legacy/quiz-core.js';
import conv from '../../data/conv.json';
import { LS_KEYS } from '../../storage/keys';
import { lsGetJSON, lsSetJSON } from '../../storage/local';

export type Tense = 'present' | 'past' | 'future' | 'progressive';
export const TENSE_LABEL: Record<Tense, string> = { present: '현재형', past: '과거형', future: '미래형', progressive: '진행형' };

export interface QuizItem {
  id: string; folderId: string; titleKo: string; expression: string; meaningKo: string; tense: Tense; ko: string; en: string;
}
export interface Grade { ok: boolean; ratio: number; hasExpr: boolean; missing: string[]; extra: string[] }
export interface Result { id: string; ok: boolean; corrected: boolean }
export interface Round { queue: string[]; round: number; cursor: number; results: Result[] }
/** legacy elab_quiz_v1 과 같은 형식 */
export interface MainState extends Round { completed: Record<string, { wrong: number }>; wrong: Record<string, number> }
/** 틀렸던 문장 복습 세션 (저장하지 않음) */
export interface ReviewState extends Round { pool: string[]; passed: Record<string, 1> }
export interface Listen { words: string[]; order: number[]; picked: number[]; done: boolean; bad: number }

const FOLDERS = conv.folders;
type Rand = () => number;

/** 문장 id = "<folderId>|<cardIndex>|<tense>" */
export const POOL: string[] = qBuildPool(FOLDERS);
export const lookup = (id: string): QuizItem | null => qLookup(FOLDERS, id);
export const grade = (text: string, it: QuizItem): Grade => qGrade(text, it.expression, it.en);

export const blankMain = (): MainState => ({ completed: {}, wrong: {}, queue: [], round: 1, cursor: 0, results: [] });

export function loadMain(): MainState {
  const s = lsGetJSON<Partial<MainState> | null>(LS_KEYS.quiz, {}) ?? {};
  return {
    completed: s.completed || {}, wrong: s.wrong || {},
    queue: Array.isArray(s.queue) ? s.queue : [],
    round: s.round || 1, cursor: s.cursor || 0,
    results: Array.isArray(s.results) ? s.results : [],
  };
}

export const saveMain = (s: MainState): void => lsSetJSON(LS_KEYS.quiz, s);

/** legacy startRound: 남은 문장을 유지하고 5개까지 채워 섞는다. */
export function newRound<R extends Round>(r: R, done: Record<string, unknown>, pool: string[], rand?: Rand): R {
  const queue = qShuffle(qRefill(r.queue.filter(id => !done[id]), pool, done, rand), rand);
  return { ...r, queue, cursor: 0, results: [] };
}

export const wrongIds = (s: MainState): string[] => Object.keys(s.completed).filter(id => s.completed[id].wrong > 0);

export function startListen(en: string, rand?: Rand): Listen {
  const words: string[] = qzWords(en);
  return { words, order: qShuffle(words.map((_, i) => i), rand), picked: [], done: false, bad: -1 };
}

/** 같은 단어가 여러 개일 수 있으므로 인덱스가 아니라 글자로 비교한다. */
export function pickTile(l: Listen, i: number): Listen {
  if(l.done) return l;
  if(l.words[i] !== l.words[l.picked.length]) return { ...l, bad: i };
  const picked = [...l.picked, i];
  return { ...l, bad: -1, picked, done: picked.length === l.words.length };
}

export const nextRate = (r: number): number => (r === 1 ? 0.75 : r === 0.75 ? 0.5 : 1);
```

Run: `npx vitest run src/features/quiz/model` → 10 passed. `npx tsc --noEmit` → 출력 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/features/quiz/model.ts src/features/quiz/model.test.ts
git commit -m "feat(quiz): 퀴즈 모델 (조회·채점·elab_quiz_v1 형식·라운드·듣기 타일)"
```

---

### Task 5: 퀴즈 스토어 (legacy 진행 로직)

legacy의 `startRound`, `ensureRound`, `submitAnswer`, `bumpWrong`, `correctMe`, `nextQuestion`, `nextRound`, `startReview`, `endReview`, `resetAll`, `goListen`, `sayLine`, `pickTile`과 `draw()` 앞부분의 "quiz 화면이면 라운드 보장, 문장이 없으면 done" 규칙(`settle`)을 옮긴다. `qs`가 바뀔 때마다 `elab_quiz_v1`에 저장한다(legacy `qSave` 호출 지점과 같은 효과).

**Files:**
- Create: `src/features/quiz/store.ts`, `src/features/quiz/store.test.ts`

- [ ] **Step 1: 테스트** — `src/features/quiz/store.test.ts`

```ts
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../speech/tts', () => ({
  speak: vi.fn(),
  whenVoicesReady: (cb: () => void) => cb(),
}));

import { speak } from '../../speech/tts';
import { POOL, lookup } from './model';
import { activeRound, initialQuizState, useQuizStore } from './store';

const st = () => useQuizStore.getState();
const saved = () => JSON.parse(localStorage.getItem('elab_quiz_v1') || 'null');
const curItem = () => { const a = activeRound(st()); return lookup(a.queue[a.cursor])!; };

beforeEach(() => {
  localStorage.clear();
  vi.mocked(speak).mockClear();
  useQuizStore.setState(initialQuizState());
});

it('open: 빈 상태면 5문장 라운드를 만들고 저장한다', () => {
  st().open();
  expect(st().view).toBe('quiz');
  expect(st().qs.queue).toHaveLength(5);
  expect(saved().queue).toEqual(st().qs.queue);
});

it('오답: result 화면, 오답 횟수 1 저장', () => {
  st().open();
  const id = st().qs.queue[0];
  st().submit('totally wrong');
  expect(st().view).toBe('result');
  expect(st().cur).toMatchObject({ id, ok: false, corrected: false });
  expect(saved().wrong[id]).toBe(1);
});

it('사실 맞았어요: 오답 횟수를 되돌리고 정답 처리', () => {
  st().open();
  const id = st().qs.queue[0];
  st().submit('totally wrong');
  st().correctMe();
  expect(st().cur).toMatchObject({ ok: true, corrected: true });
  expect(saved().wrong[id]).toBeUndefined();
});

it('정답 후 다음: 완료함에 들어가고 다음 문장으로', () => {
  st().open();
  const id = st().qs.queue[0];
  st().submit(curItem().en);
  expect(st().cur?.ok).toBe(true);
  st().next();
  expect(st().qs.completed[id]).toEqual({ wrong: 0 });
  expect(st().qs.cursor).toBe(1);
  expect(st().view).toBe('quiz');
  expect(saved().completed[id]).toEqual({ wrong: 0 });
});

it('틀린 채로 다음: 완료함에 넣지 않고 오답 기록 유지', () => {
  st().open();
  const id = st().qs.queue[0];
  st().submit('nope');
  st().next();
  expect(st().qs.completed[id]).toBeUndefined();
  expect(st().qs.wrong[id]).toBe(1);
  expect(st().qs.results).toEqual([{ id, ok: false, corrected: false }]);
});

it('라운드 끝 → summary, 다음 라운드는 틀린 문장을 남기고 새로 채운다', () => {
  st().open();
  const first = st().qs.queue[0];
  st().submit('nope'); st().next();
  for(let i = 1; i < 5; i++){ st().submit(curItem().en); st().next(); }
  expect(st().view).toBe('summary');
  st().nextRound();
  expect(st().qs.round).toBe(2);
  expect(st().view).toBe('quiz');
  expect(st().qs.queue).toContain(first);
  expect(st().qs.queue).toHaveLength(5);
});

it('복습: 틀렸던 완료 문장만, 오답이면 완료 기록의 wrong 을 올린다', () => {
  const id = POOL[3];
  useQuizStore.setState({ qs: { ...st().qs, completed: { [id]: { wrong: 2 } } } });
  st().startReview();
  expect(st().mode).toBe('review');
  expect(st().rev?.queue).toEqual([id]);
  st().submit('nope');
  expect(st().qs.completed[id].wrong).toBe(3);
  st().endReview();
  expect(st()).toMatchObject({ mode: 'main', rev: null, view: 'completed' });
});

it('복습 대상이 없으면 시작하지 않는다', () => {
  st().startReview();
  expect(st().mode).toBe('main');
});

it('전체 초기화', () => {
  st().open();
  st().submit('nope');
  st().resetAll();
  expect(st().qs.wrong).toEqual({});
  expect(st().qs.completed).toEqual({});
  expect(st().qs.queue).toHaveLength(5);
  expect(st().view).toBe('quiz');
});

it('듣고 순서 맞추기: 모범 답안을 현재 속도로 읽고, 속도를 바꾸면 다시 읽는다', () => {
  st().open();
  st().submit('nope');
  const en = st().cur!.it.en;
  st().goListen();
  expect(st().view).toBe('listen');
  expect(speak).toHaveBeenLastCalledWith(en, 1);
  st().cycleRate();
  expect(st().lisRate).toBe(0.75);
  expect(speak).toHaveBeenLastCalledWith(en, 0.75);
  const words = st().lis!.words;
  words.forEach((_, i) => st().pickTile(i));
  expect(st().lis?.done).toBe(true);
});

it('모든 문장을 완료했으면 done', () => {
  const completed = Object.fromEntries(POOL.map(id => [id, { wrong: 0 }]));
  useQuizStore.setState({ qs: { ...st().qs, completed } });
  st().open();
  expect(st().view).toBe('done');
});
```

Run: `npx vitest run src/features/quiz/store` → FAIL (모듈 없음)

- [ ] **Step 2: `src/features/quiz/store.ts`**

```ts
import { create } from 'zustand';
import { speak, whenVoicesReady } from '../../speech/tts';
import {
  POOL, blankMain, grade, loadMain, lookup, newRound, nextRate, pickTile as pickTileIn, saveMain, startListen, wrongIds,
  type Grade, type Listen, type MainState, type QuizItem, type ReviewState, type Round,
} from './model';

export type View = 'quiz' | 'result' | 'listen' | 'summary' | 'done' | 'completed';
export type Mode = 'main' | 'review';
export interface Current { id: string; it: QuizItem; g: Grade; text: string; ok: boolean; corrected: boolean }

interface Data {
  qs: MainState;
  mode: Mode;
  rev: ReviewState | null;
  view: View;
  cur: Current | null;
  lis: Listen | null;
  lisRate: number;
}
interface Actions {
  open(): void;
  go(view: 'quiz' | 'completed'): void;
  submit(text: string): void;
  correctMe(): void;
  goListen(): void;
  sayLine(): void;
  pickTile(i: number): void;
  clearBad(): void;
  cycleRate(): void;
  next(): void;
  nextRound(): void;
  startReview(): void;
  endReview(): void;
  resetAll(): void;
}
export type QuizState = Data & Actions;

export const activeRound = (s: Data): Round => (s.mode === 'review' ? s.rev! : s.qs);
const passedOf = (s: Data): Record<string, unknown> => (s.mode === 'review' ? s.rev!.passed : s.qs.completed);
const poolOf = (s: Data): string[] => (s.mode === 'review' ? s.rev!.pool : POOL);
const withRound = (s: Data, r: Partial<Round>): Partial<Data> =>
  s.mode === 'review' ? { rev: { ...s.rev!, ...r } } : { qs: { ...s.qs, ...r } };

/** legacy draw() 앞부분: quiz 화면이면 라운드를 보장하고, 남은 문장이 없으면 done. */
function settle(s: Data): Partial<Data> {
  if(s.view !== 'quiz') return {};
  let next = s;
  const a = activeRound(s);
  if(!a.queue.length || a.cursor >= a.queue.length) next = { ...s, ...withRound(s, newRound(a, passedOf(s), poolOf(s))) };
  const patch: Partial<Data> = next === s ? {} : { qs: next.qs, rev: next.rev };
  if(!activeRound(next).queue.length) patch.view = 'done';
  return patch;
}

/** legacy bumpWrong: 복습 중이면 완료 기록의 wrong, 아니면 진행 중 오답 횟수. */
function bumpWrong(s: Data, id: string, delta: number): Partial<Data> {
  if(s.mode === 'review'){
    const rec = s.qs.completed[id];
    if(!rec) return {};
    return { qs: { ...s.qs, completed: { ...s.qs.completed, [id]: { ...rec, wrong: Math.max(0, (rec.wrong || 0) + delta) } } } };
  }
  const n = Math.max(0, (s.qs.wrong[id] || 0) + delta);
  const wrong = { ...s.qs.wrong };
  if(n) wrong[id] = n; else delete wrong[id];
  return { qs: { ...s.qs, wrong } };
}

export const initialQuizState = (): Data => ({
  qs: loadMain(), mode: 'main', rev: null, view: 'quiz', cur: null, lis: null, lisRate: 1,
});

export const useQuizStore = create<QuizState>()((set, get) => {
  /** 변경을 적용한 뒤 settle 까지 반영한다 (legacy 의 "상태 변경 → draw()") */
  const apply = (patch: Partial<Data>) => set(s => {
    const merged = { ...s, ...patch };
    return { ...patch, ...settle(merged) };
  });

  return {
    ...initialQuizState(),

    open: () => apply({}),
    go: view => apply({ view }),

    submit: text => {
      const s = get(), a = activeRound(s), id = a.queue[a.cursor], it = lookup(id);
      if(!it) return;
      const g = grade(text, it);
      apply({ ...(g.ok ? {} : bumpWrong(s, id, 1)), cur: { id, it, g, text, ok: g.ok, corrected: false }, view: 'result' });
    },

    correctMe: () => {
      const s = get();
      if(!s.cur || s.cur.ok) return;
      apply({ ...bumpWrong(s, s.cur.id, -1), cur: { ...s.cur, ok: true, corrected: true } });
    },

    goListen: () => {
      const s = get();
      if(!s.cur) return;
      apply({ lis: startListen(s.cur.it.en), view: 'listen' });
      get().sayLine();
    },

    sayLine: () => {
      const s = get();
      if(!s.cur) return;
      const en = s.cur.it.en, rate = s.lisRate;
      whenVoicesReady(() => speak(en, rate));
    },

    pickTile: i => { const l = get().lis; if(l) apply({ lis: pickTileIn(l, i) }); },
    clearBad: () => { const l = get().lis; if(l && l.bad !== -1) apply({ lis: { ...l, bad: -1 } }); },
    cycleRate: () => { apply({ lisRate: nextRate(get().lisRate) }); get().sayLine(); },

    next: () => {
      const s = get(), cur = s.cur;
      if(!cur) return;
      const a = activeRound(s);
      const results = [...a.results, { id: cur.id, ok: cur.ok, corrected: cur.corrected }];
      const cursor = a.cursor + 1;
      let patch: Partial<Data> = withRound(s, { results, cursor });
      if(cur.ok){
        if(s.mode === 'review') patch = { rev: { ...patch.rev!, passed: { ...s.rev!.passed, [cur.id]: 1 } } };
        else {
          const wrong = { ...s.qs.wrong };
          delete wrong[cur.id];
          patch = { qs: { ...patch.qs!, completed: { ...s.qs.completed, [cur.id]: { wrong: s.qs.wrong[cur.id] || 0 } }, wrong } };
        }
      }
      apply({ ...patch, cur: null, lis: null, view: cursor >= a.queue.length ? 'summary' : 'quiz' });
    },

    nextRound: () => {
      const s = get(), a = activeRound(s);
      const r = newRound({ ...a, round: a.round + 1 }, passedOf(s), poolOf(s));
      apply({ ...withRound(s, r), view: r.queue.length ? 'quiz' : 'done' });
    },

    startReview: () => {
      const s = get(), pool = wrongIds(s.qs);
      if(!pool.length) return;
      const rev: ReviewState = { pool, passed: {}, queue: [], round: 1, cursor: 0, results: [] };
      apply({ mode: 'review', rev: newRound(rev, rev.passed, pool), cur: null, lis: null, view: 'quiz' });
    },

    endReview: () => apply({ mode: 'main', rev: null, cur: null, lis: null, view: 'completed' }),

    resetAll: () => {
      const blank = blankMain();
      apply({ qs: newRound(blank, blank.completed, POOL), mode: 'main', rev: null, cur: null, lis: null, view: 'quiz' });
    },
  };
});

// legacy qSave: 진행 기록(qs)이 바뀔 때마다 저장한다. 복습 세션(rev)은 저장하지 않는다.
useQuizStore.subscribe((s, prev) => { if(s.qs !== prev.qs) saveMain(s.qs); });
```

Run: `npx vitest run src/features/quiz/store` → 11 passed. `npx tsc --noEmit` → 출력 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/features/quiz/store.ts src/features/quiz/store.test.ts
git commit -m "feat(quiz): 퀴즈 진행 로직을 Zustand 스토어로 이관 (elab_quiz_v1 자동 저장)"
```

---

### Task 6: 퀴즈 화면

legacy `quizHTML`, `resultHTML`, `listenHTML`, `summaryHTML`, `doneHTML`, `completedHTML`, `headHTML`, `dots`, `highlightEn`, `diffHTML`을 같은 class 이름의 JSX로 옮긴다. HTML 문자열 대신 JSX를 쓰므로 `esc()`가 필요 없다. 화면 맨 위로 올리기는 legacy처럼 매번 그릴 때가 아니라 **화면이나 문제가 바뀔 때만** 한다(타일을 누를 때마다 맨 위로 튀지 않게).

**Files:**
- Create: `src/features/quiz/parts.tsx`, `src/features/quiz/views.tsx`, `src/features/quiz/QuizScreen.tsx`, `src/features/quiz/QuizScreen.test.tsx`
- Modify: `src/app/screens.tsx`

- [ ] **Step 1: 화면 테스트** — `src/features/quiz/QuizScreen.test.tsx`

```tsx
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../speech/tts', () => ({ speak: vi.fn(), whenVoicesReady: (cb: () => void) => cb() }));

import { speak } from '../../speech/tts';
import { lookup } from './model';
import { activeRound, initialQuizState, useQuizStore } from './store';
import { QuizScreen } from './QuizScreen';

const current = () => { const a = activeRound(useQuizStore.getState()); return lookup(a.queue[a.cursor])!; };

beforeEach(() => {
  localStorage.clear();
  vi.mocked(speak).mockClear();
  useQuizStore.setState(initialQuizState());
});

it('문제 화면: 한국어 문장, 라운드, 진행 표시', () => {
  render(<QuizScreen />);
  expect(screen.getByText(current().ko)).toBeInTheDocument();
  expect(screen.getByText('라운드 1')).toBeInTheDocument();
  expect(screen.getByText('1 / 5')).toBeInTheDocument();
  expect(document.querySelectorAll('.qz-dots i')).toHaveLength(5);
});

it('오답 제출 → 채점 결과, 모범 답안에 표현 강조', () => {
  render(<QuizScreen />);
  const it0 = current();
  fireEvent.change(screen.getByPlaceholderText('영어로 입력하세요'), { target: { value: 'nope' } });
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  expect(screen.getByText('✗ 다시 확인해 보세요')).toBeInTheDocument();
  expect(document.querySelector('.qz-en')?.textContent).toContain(it0.en);
  expect(document.querySelectorAll('.qz-en mark').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: '사실 맞았어요' }));
  expect(screen.getByText('✓ 정답 처리했어요')).toBeInTheDocument();
});

it('Ctrl+Enter 로도 제출', () => {
  render(<QuizScreen />);
  const ta = screen.getByPlaceholderText('영어로 입력하세요');
  fireEvent.change(ta, { target: { value: current().en } });
  fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true });
  expect(screen.getByText('✓ 정답이에요')).toBeInTheDocument();
});

it('듣고 순서 맞추기 → 타일을 순서대로 누르면 정답 문장과 다음 버튼', () => {
  render(<QuizScreen />);
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  fireEvent.click(screen.getByRole('button', { name: /듣고 순서 맞추기/ }));
  expect(speak).toHaveBeenCalled();
  const words = useQuizStore.getState().lis!.words;
  words.forEach((w, i) => {
    const tile = document.querySelector<HTMLButtonElement>(`.qz-tiles [data-pick="${i}"]`)!;
    expect(tile.textContent).toBe(w);
    fireEvent.click(tile);
  });
  expect(screen.getByText('✓ 순서를 맞혔어요')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /다음 문장/ }));
  expect(screen.getByText('2 / 5')).toBeInTheDocument();
});

it('완료함과 초기화(확인 창)', () => {
  render(<QuizScreen />);
  fireEvent.click(screen.getByRole('button', { name: /완료 0 \// }));
  expect(screen.getByText('아직 완료한 문장이 없어요.')).toBeInTheDocument();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: '퀴즈 기록 초기화' }));
  expect(confirm).toHaveBeenCalled();
  expect(screen.getByText('아직 완료한 문장이 없어요.')).toBeInTheDocument();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: '퀴즈 기록 초기화' }));
  expect(screen.getByText('라운드 1')).toBeInTheDocument();
  confirm.mockRestore();
});
```

Run: `npx vitest run src/features/quiz/QuizScreen` → FAIL (모듈 없음)

- [ ] **Step 2: `src/features/quiz/parts.tsx`**

```tsx
import type { ReactNode } from 'react';
import { exprWords, qNorm, variants } from '../../core/legacy/quiz-core.js';
import { speak } from '../../speech/tts';
import { POOL, type Result } from './model';
import { useQuizStore } from './store';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** legacy highlightEn: 핵심 표현 단어(어형변화 포함)를 <mark> 로 */
export function markExpression(en: string, expression: string): ReactNode[] {
  const words: string[] = exprWords(expression);
  if(!words.length) return [en];
  const all = words.flatMap((w: string) => variants(w) as string[]).sort((a, b) => b.length - a.length).map(escapeRe);
  const re = new RegExp('\\b(' + all.join('|') + ')\\b', 'ig');
  return en.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

/** legacy diffHTML: 모범 답안에 없는 내 단어를 흐리게 */
export function dimExtra(text: string, extra: string[]): ReactNode[] {
  const dim = new Set(extra);
  return text.split(/(\s+)/).map((w, i) => {
    const k = qNorm(w);
    return k && dim.has(k) ? <span key={i} className="qz-dim">{w}</span> : w;
  });
}

export function SpeakButton({ text }: { text: string }) {
  return (
    <button className="qz-spk" aria-label="발음 듣기" onClick={e => { e.stopPropagation(); speak(text); }}>▶</button>
  );
}

export function Head({ sub }: { sub: string }) {
  const done = useQuizStore(s => Object.keys(s.qs.completed).length);
  const go = useQuizStore(s => s.go);
  const pct = POOL.length ? done / POOL.length * 100 : 0;
  return (
    <div className="qz-head">
      <div className="qz-h1">영작 퀴즈<span>{sub}</span></div>
      <div className="qz-hbar"><i style={{ width: pct.toFixed(2) + '%' }} /></div>
      <button className="qz-hchip" onClick={() => go('completed')}>완료 {done} / {POOL.length} ›</button>
    </div>
  );
}

export function Dots({ n, results, total }: { n: number; results: Result[]; total: number }) {
  return (
    <div className="qz-dots">
      {Array.from({ length: total }, (_, i) => {
        const r = results[i];
        const cls = r ? (r.ok ? 'ok' : 'no') : i === n ? 'now' : undefined;
        return <i key={i} className={cls} />;
      })}
    </div>
  );
}

export function Steps({ on }: { on: 1 | 2 | 3 }) {
  const c = (n: number) => (n === on ? 'on' : undefined);
  return <div className="qz-step"><i className={c(1)}>1</i>영작<i className={c(2)}>2</i>답 확인<i className={c(3)}>3</i>듣고 순서</div>;
}
```

- [ ] **Step 3: `src/features/quiz/views.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { POOL, TENSE_LABEL, lookup, wrongIds } from './model';
import { Dots, Head, SpeakButton, Steps, dimExtra, markExpression } from './parts';
import { activeRound, useQuizStore } from './store';

const reviewSub = (sub: string) => (useQuizStore.getState().mode === 'review' ? '틀렸던 문장 복습' : sub);

export function QuestionView() {
  const st = useQuizStore();
  const [text, setText] = useState('');
  const a = activeRound(st);
  const it = lookup(a.queue[a.cursor] ?? '');
  if(!it) return null;
  const badge = st.mode === 'review' ? '복습' : '라운드 ' + a.round;
  const submit = () => st.submit(text);
  return (
    <>
      <Head sub={reviewSub('한국어를 영어로 써 보세요')} />
      <div className="qz-meta">
        <span className="qz-round">{badge}</span>
        <Dots n={a.cursor} total={a.queue.length} results={a.results} />
        <span className="qz-cnt">{a.cursor + 1} / {a.queue.length}</span>
      </div>
      <Steps on={1} />
      <div className="qz-lis-title">이 문장을 영어로 써 보세요</div>
      <div className="qz-card ko"><div className="qz-ko">{it.ko}</div></div>
      <textarea
        id="qzInput" className="qz-ta" rows={3} placeholder="영어로 입력하세요"
        autoCapitalize="sentences" autoComplete="off" spellCheck={false}
        value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); }}
      />
      <button className="qz-btn fill" id="qzSubmit" onClick={submit}>확인</button>
      {st.mode === 'review' && <button className="qz-btn ghost" onClick={st.endReview}>복습 그만두기</button>}
    </>
  );
}

export function ResultView() {
  const st = useQuizStore();
  const cur = st.cur;
  if(!cur) return null;
  const { it, g, ok } = cur;
  return (
    <>
      <Head sub={reviewSub('채점 결과')} />
      <Steps on={2} />
      <div className={'qz-lis-verdict ' + (ok ? 'ok' : 'no')}>
        {ok ? (cur.corrected ? '✓ 정답 처리했어요' : '✓ 정답이에요') : '✗ 다시 확인해 보세요'}
        {!ok && <small>일치율 {Math.round(g.ratio * 100)}%{g.hasExpr ? '' : ' · 핵심 표현 누락'}</small>}
      </div>
      <div className="qz-card">
        <div className="qz-lab">내 답</div>
        <div className="qz-mine">{cur.text.trim() ? dimExtra(cur.text, g.extra) : <span className="qz-dim">(입력 없음)</span>}</div>
        {g.missing.length > 0 && <div className="qz-miss">빠진 단어 · {g.missing.join(', ')}</div>}
      </div>
      <div className="qz-card ans">
        <div className="qz-lab teal">모범 답안</div>
        <div className="qz-en"><span>{markExpression(it.en, it.expression)}</span><SpeakButton text={it.en} /></div>
        <div className="qz-ko2">{it.ko}</div>
        <div className="qz-tags"><span>{it.expression}</span><span className="t">{TENSE_LABEL[it.tense]}</span><span className="t">{it.titleKo}</span></div>
        <div className="qz-mean">{it.meaningKo}</div>
      </div>
      <div className="qz-row">
        {!ok && <button className="qz-btn ghost" id="qzCorrect" onClick={st.correctMe}>사실 맞았어요</button>}
        <button className="qz-btn fill" id="qzListen" onClick={st.goListen}>듣고 순서 맞추기 ›</button>
      </div>
    </>
  );
}

export function ListenView() {
  const st = useQuizStore();
  const { cur, lis, clearBad } = st;
  // 틀린 타일은 0.42초 동안만 붉게 (legacy badT)
  useEffect(() => {
    if(!lis || lis.bad === -1) return;
    const t = setTimeout(clearBad, 420);
    return () => clearTimeout(t);
  }, [lis, clearBad]);
  if(!cur || !lis) return null;
  const it = cur.it;
  const remaining = lis.order.filter(i => !lis.picked.includes(i));
  return (
    <>
      <Head sub={reviewSub('듣고 순서 맞추기')} />
      <Steps on={3} />
      <div className="qz-lis">
        <div className="qz-lis-title">{lis.done ? <b className="ok">✓ 순서를 맞혔어요</b> : '잘 듣고 문장을 완성해 보세요'}</div>
        <div className={'qz-slot' + (lis.done ? ' done' : '')}>
          {lis.picked.length
            ? lis.picked.map(wi => <span key={wi} className="qz-tile in">{lis.words[wi]}</span>)
            : <span className="qz-ph">들리는 순서대로 단어를 탭하세요</span>}
        </div>
        {!lis.done && (
          <div className="qz-tiles">
            {remaining.map(i => (
              <button key={i} className={'qz-tile' + (lis.bad === i ? ' bad' : '')} data-pick={i} onClick={() => st.pickTile(i)}>
                {lis.words[i]}
              </button>
            ))}
          </div>
        )}
        <div className="qz-stage">
          <button className="qz-playbtn" id="qzPlay" aria-label="다시 듣기" onClick={st.sayLine}>▶</button>
          <button className="qz-rate" id="qzRate" onClick={st.cycleRate}>{st.lisRate}x</button>
        </div>
      </div>
      {lis.done && (
        <>
          <div className="qz-card ans">
            <div className="qz-lab teal">정답 문장</div>
            <div className="qz-en"><span>{markExpression(it.en, it.expression)}</span><SpeakButton text={it.en} /></div>
            <div className="qz-ko2">{it.ko}</div>
          </div>
          <button className="qz-btn fill" id="qzNext" onClick={st.next}>다음 문장 ›</button>
        </>
      )}
    </>
  );
}

export function SummaryView() {
  const st = useQuizStore();
  const a = activeRound(st);
  const okN = a.results.filter(r => r.ok).length;
  const miss = a.results.filter(r => !r.ok);
  const label = (st.mode === 'review' ? '복습 라운드 ' : '라운드 ') + a.round;
  return (
    <>
      <Head sub="라운드 결과" />
      <div className="qz-sum"><div className="n">{okN} <small>/ {a.results.length} 정답</small></div><div className="l">{label} 완료</div></div>
      {miss.length ? (
        <>
          <div className="qz-lab2">다음 라운드에 다시 나올 문장 {miss.length}개</div>
          {miss.map((r, i) => {
            const it = lookup(r.id);
            return it && <div key={i} className="qz-mrow"><div className="k">{it.ko}</div><div className="e">{it.en}</div></div>;
          })}
        </>
      ) : <div className="qz-allok">이 라운드는 전부 맞혔어요 🎉</div>}
      <button className="qz-btn fill" id="qzNextRound" onClick={st.nextRound}>다음 라운드 ›</button>
    </>
  );
}

export function DoneView() {
  const st = useQuizStore();
  if(st.mode === 'review') return (
    <>
      <Head sub="복습 완료" />
      <div className="qz-done"><div className="e">🎉</div><b>틀렸던 문장을 전부 맞혔어요</b><p>복습 기록은 완료함에 그대로 남아 있어요.</p></div>
      <button className="qz-btn fill" onClick={st.endReview}>완료함으로</button>
    </>
  );
  return (
    <>
      <Head sub="전체 완료" />
      <div className="qz-done"><div className="e">🏆</div><b>{POOL.length}문장을 모두 맞혔어요</b><p>틀렸던 문장만 다시 풀어볼 수 있어요.</p></div>
      <button className="qz-btn fill" onClick={() => st.go('completed')}>완료함 보기</button>
    </>
  );
}

export function CompletedView() {
  const st = useQuizStore();
  const ids = Object.keys(st.qs.completed).sort((x, y) => (st.qs.completed[y].wrong || 0) - (st.qs.completed[x].wrong || 0));
  const hard = wrongIds(st.qs);
  const reset = () => { if(window.confirm('퀴즈 완료 기록과 진행 중인 라운드를 모두 지울까요?')) st.resetAll(); };
  return (
    <>
      <div className="qz-head">
        <button className="qz-back" aria-label="뒤로" onClick={() => st.go('quiz')}>‹</button>
        <div className="qz-h1">완료함<span>{ids.length}문장 · 틀렸던 문장 {hard.length}개</span></div>
      </div>
      {hard.length > 0 && <button className="qz-btn fill" id="qzReview" onClick={st.startReview}>틀렸던 것만 다시 풀기 ({hard.length})</button>}
      {ids.length ? (
        <>
          <div className="qz-lab2">완료한 문장</div>
          {ids.map(id => {
            const it = lookup(id);
            if(!it) return null;
            const w = st.qs.completed[id].wrong || 0;
            return (
              <div key={id} className="qz-crow">
                <div className="b"><div className="k">{it.ko}</div><div className="e">{it.en}</div></div>
                {w > 0 && <span className="qz-wbadge">{w}회</span>}
                <SpeakButton text={it.en} />
              </div>
            );
          })}
        </>
      ) : <div className="qz-empty">아직 완료한 문장이 없어요.</div>}
      <div className="qz-footer"><button id="qzReset" onClick={reset}>퀴즈 기록 초기화</button></div>
    </>
  );
}
```

- [ ] **Step 4: `src/features/quiz/QuizScreen.tsx`**

```tsx
import { useEffect } from 'react';
import { activeRound, useQuizStore } from './store';
import { CompletedView, DoneView, ListenView, QuestionView, ResultView, SummaryView } from './views';

// legacy <div class="qz qzui" id="qzRoot"> 와 draw() 분기
export function QuizScreen() {
  const view = useQuizStore(s => s.view);
  const open = useQuizStore(s => s.open);
  const mode = useQuizStore(s => s.mode);
  const round = useQuizStore(s => activeRound(s).round);
  const cursor = useQuizStore(s => activeRound(s).cursor);

  useEffect(() => { open(); }, [open]);
  useEffect(() => { window.scrollTo(0, 0); }, [view, cursor]);

  return (
    <div className="qz qzui" id="qzRoot">
      {view === 'quiz' && <QuestionView key={`${mode}-${round}-${cursor}`} />}
      {view === 'result' && <ResultView />}
      {view === 'listen' && <ListenView />}
      {view === 'summary' && <SummaryView />}
      {view === 'done' && <DoneView />}
      {view === 'completed' && <CompletedView />}
    </div>
  );
}
```

- [ ] **Step 5: 퀴즈 탭에 연결** — `src/app/screens.tsx`

import를 추가하고 `wquiz` 줄을 바꾼다.

```tsx
import { QuizScreen } from '../features/quiz/QuizScreen';
```

```tsx
  wquiz: { id: 'screen-wquiz', inMain: false, render: () => <QuizScreen /> },
```

- [ ] **Step 6: 테스트·타입·빌드 확인**

Run: `npx vitest run src/features/quiz` → 26 passed (model 10 + store 11 + screen 5)
Run: `npm test` → 135 passed. `npx tsc --noEmit` → 출력 없음. `npm run build` → 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add src/features/quiz src/app/screens.tsx
git commit -m "feat(quiz): 영작 퀴즈 화면 이관 (문제·채점·듣기·라운드·완료함)"
```

---

### Task 7: legacy와 나란히 비교 확인

- [ ] **Step 1: 두 앱 띄우기**

- 새 앱: `npm run dev` → `http://localhost:5173`
- legacy: `python -m http.server 8123 -d legacy`로 정적 서버를 띄운다 → `http://localhost:8123`

두 곳 모두 퀴즈 탭에서 같은 동작을 해 보고 비교한다.

- [ ] **Step 2: 확인 항목**

1. 화면 모양: 머리말, 진행 막대, 라운드 배지, 진행 점, 단계 표시, 카드, 버튼이 legacy와 같다(모바일 375px 폭 포함).
2. 오답 제출 → 일치율, 핵심 표현 누락, 빠진 단어, 흐린 단어, 표현 강조가 같은 문장에서 같다.
3. "사실 맞았어요" → 정답 처리 문구.
4. 듣고 순서 맞추기 → 자동 재생, 틀린 타일이 잠깐 붉게, 속도 1x → 0.75x → 0.5x.
5. 라운드 5문장을 끝내면 결과 화면, 다음 라운드에 틀린 문장이 다시 나온다.
6. 완료함: 틀린 횟수 순 정렬, 복습 시작/그만두기, 초기화 확인 창.
7. **저장 형식:** 새 앱에서 몇 문제를 푼 뒤 DevTools에서 `localStorage.elab_quiz_v1` 값을 복사해 legacy 쪽(8123)의 같은 키에 넣고 새로고침하면, legacy가 같은 진도와 완료함을 보여준다. 반대 방향도 확인한다.
8. 새로고침해도 진행 중인 라운드와 위치가 유지된다.

- [ ] **Step 3: 미리보기 배포 확인**

```bash
git push
```

`https://react-migration--<사이트이름>.netlify.app`에서 퀴즈 탭으로 Step 2의 1~6과 8을 다시 확인한다. 이 주소는 실제 사이트와 출처가 달라 저장소가 비어 있으므로, 처음부터 라운드 1로 시작하는 것이 정상이다.
