# React 이관 Phase 3 (회화 탭 + 퀴즈 표현 모드) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회화 탭(주제 홈, 카테고리, 주제별 표현 목록, 북마크, 진도)을 옮기고, 표현 하나를 4시제로 연습하는 퀴즈 표현 모드(legacy `QuizApp.runExpression`)를 추가한다.

**Architecture:** 퀴즈 스토어를 `createQuizStore(initial, opts)` 팩토리로 바꾼다. 퀴즈 탭은 지금처럼 전역 스토어(`useQuizStore`, `elab_quiz_v1` 저장)를 쓰고, 회화의 표현 연습은 카드를 열 때마다 **따로 만든 표현 모드 스토어**를 쓴다. 퀴즈 화면 컴포넌트는 React context(`QuizStoreContext`)로 어느 스토어를 그릴지 받는다. 회화 진도는 별도 Zustand 스토어가 `elab_progress_v1`에 legacy와 같은 형식(`{done, marks, reveal}`)으로 저장한다.

**Tech Stack:** React 19, Zustand 5, Vitest + Testing Library, legacy CSS(`conv.css`, `quiz.css`).

**공통 규칙:** [로드맵](2026-10-13-react-migration-roadmap.md)의 공통 규칙을 따른다. `elab_progress_v1`의 이름과 형식을 바꾸지 않는다(`reveal` 값도 보존).

**legacy와 의도적으로 다른 점 (개선, 데이터 영향 없음):**
- legacy는 표현 연습이 퀴즈 탭과 같은 상태 변수를 써서, 회화에서 표현 연습을 하고 나오면 퀴즈 탭의 복습 세션과 현재 화면이 초기화됐다. 새 앱은 스토어를 분리해서 퀴즈 탭 상태가 그대로 남는다.
- 표현 연습의 듣기 속도는 시작할 때 퀴즈 탭의 속도를 이어받지만, 연습 중에 바꾼 속도가 퀴즈 탭으로 돌아가지는 않는다(legacy는 공유).
- 표현 목록의 완료·북마크 버튼에 `aria-label`(완료 표시, 북마크)을 붙인다.

**legacy 참고 위치** (`legacy/index.html`): 회화 모듈 `window.ConvApp=(function(){`(572행~800행), 화면 틀 `<section id="screen-conv">`(565행, `<main>` 안). 표현 모드는 퀴즈 모듈의 `function runExpression`, `function exitExpression`, `headHTML`의 `mode === 'expr'` 분기, `exprDoneHTML`.

---

## File Structure

| 파일 | 역할 |
|---|---|
| `src/features/quiz/model.ts` | `TENSES` 추가 |
| `src/features/quiz/store.ts` | `createQuizStore` 팩토리, 표현 모드(`expr`), `exprQuizState` |
| `src/features/quiz/context.ts` | `QuizStoreContext`, `useQuiz()` |
| `src/features/quiz/parts.tsx`, `views.tsx` | context의 스토어를 쓰도록, 표현 모드 머리말·배지·완료 화면 |
| `src/features/quiz/QuizScreen.tsx` | `QuizBody`(화면 분기) 분리 |
| `src/features/conv/data.ts` | 카테고리(11개), 주제 이모지, 조회·검색 |
| `src/features/conv/store.ts` | 회화 진도·화면·검색어·토스트 (Zustand), `elab_progress_v1` 저장 |
| `src/features/conv/views.tsx` | 홈, 카테고리, 주제, 북마크, 표현 연습 화면 |
| `src/features/conv/ConvScreen.tsx` | 회화 탭 진입점 |
| `src/app/screens.tsx` | `conv` 연결 |

---

### Task 1: 퀴즈 스토어를 팩토리로 바꾸고 표현 모드 추가

**Files:**
- Modify: `src/features/quiz/model.ts`, `src/features/quiz/store.ts`
- Create: `src/features/quiz/expr.test.ts`

- [ ] **Step 1: 테스트** — `src/features/quiz/expr.test.ts`

```ts
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../speech/tts', () => ({ speak: vi.fn(), whenVoicesReady: (cb: () => void) => cb() }));

import { createQuizStore, exprQuizState } from './store';

const FID = 'driving-on-the-road';   // 첫 카드: "hit the road"
const make = (onExit = vi.fn()) => ({ onExit, s: createQuizStore(() => exprQuizState(FID, 0, 'hit the road', '길을 떠나다, 출발하다')!, { onExit }) });

beforeEach(() => localStorage.clear());

it('표현 하나의 4시제 문장을 이 순서로, 섞지 않고 낸다', () => {
  const { s } = make();
  s.getState().open();
  expect(s.getState().mode).toBe('expr');
  expect(s.getState().expr?.queue).toEqual([`${FID}|0|present`, `${FID}|0|past`, `${FID}|0|future`, `${FID}|0|progressive`]);
  expect(s.getState().view).toBe('quiz');
});

it('없는 카드면 null', () => {
  expect(exprQuizState('없는-주제', 0, 't', 's')).toBeNull();
});

it('틀려도 퀴즈 탭 기록(오답 횟수, elab_quiz_v1)에 남기지 않는다', () => {
  const { s } = make();
  s.getState().open();
  s.getState().submit('nope');
  expect(s.getState().cur?.ok).toBe(false);
  expect(s.getState().qs.wrong).toEqual({});
  s.getState().correctMe();
  expect(s.getState().cur?.ok).toBe(true);
  expect(localStorage.getItem('elab_quiz_v1')).toBeNull();
});

it('4문장을 마치면 exprDone, 나가면 정답 수와 전체 수를 알려준다', () => {
  const { s, onExit } = make();
  s.getState().open();
  s.getState().submit('nope'); s.getState().correctMe(); s.getState().next();   // 1문장 정답 처리
  for(let i = 0; i < 3; i++){ s.getState().submit('nope'); s.getState().next(); }
  expect(s.getState().view).toBe('exprDone');
  expect(s.getState().expr?.passed).toEqual({ [`${FID}|0|present`]: 1 });
  s.getState().exit();
  expect(onExit).toHaveBeenCalledWith(1, 4);
});
```

Run: `npx vitest run src/features/quiz/expr` → FAIL (`createQuizStore`, `exprQuizState` 없음)

- [ ] **Step 2: `src/features/quiz/model.ts`에 시제 목록 추가** (`TENSE_LABEL` 바로 아래)

```ts
/** legacy QTENSES: 표현 연습에서 문제를 내는 순서 */
export const TENSES: Tense[] = ['present', 'past', 'future', 'progressive'];
```

- [ ] **Step 3: `src/features/quiz/store.ts` 전체 교체**

```ts
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { speak, whenVoicesReady } from '../../speech/tts';
import {
  POOL, TENSES, blankMain, grade, loadMain, lookup, newRound, nextRate, pickTile as pickTileIn, saveMain, startListen, wrongIds,
  type Grade, type Listen, type MainState, type QuizItem, type ReviewState, type Round,
} from './model';

export type View = 'quiz' | 'result' | 'listen' | 'summary' | 'done' | 'completed' | 'exprDone';
/** main: 퀴즈 탭 진행, review: 틀렸던 문장 복습, expr: 회화 탭의 표현 1개 연습 */
export type Mode = 'main' | 'review' | 'expr';
export interface Current { id: string; it: QuizItem; g: Grade; text: string; ok: boolean; corrected: boolean }
/** 표현 1개(4시제) 연습. 기록을 남기지 않는다 (legacy expr). */
export interface ExprState extends Round { passed: Record<string, 1>; title: string; sub: string }

export interface QuizData {
  qs: MainState;
  mode: Mode;
  rev: ReviewState | null;
  expr: ExprState | null;
  view: View;
  cur: Current | null;
  lis: Listen | null;
  lisRate: number;
}
interface Actions {
  /** 화면에 들어올 때 호출 (legacy QuizApp.render → draw) */
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
  /** 표현 연습에서 나가기 (legacy exitExpression) */
  exit(): void;
}
export type QuizState = QuizData & Actions;
export type QuizStore = UseBoundStore<StoreApi<QuizState>>;
export interface QuizStoreOptions { onExit?: (okN: number, total: number) => void }

export const activeRound = (s: QuizData): Round => (s.mode === 'expr' ? s.expr! : s.mode === 'review' ? s.rev! : s.qs);
const passedOf = (s: QuizData): Record<string, unknown> =>
  s.mode === 'expr' ? s.expr!.passed : s.mode === 'review' ? s.rev!.passed : s.qs.completed;
const poolOf = (s: QuizData): string[] => (s.mode === 'review' ? s.rev!.pool : POOL);
const withRound = (s: QuizData, r: Partial<Round>): Partial<QuizData> =>
  s.mode === 'expr' ? { expr: { ...s.expr!, ...r } }
    : s.mode === 'review' ? { rev: { ...s.rev!, ...r } }
    : { qs: { ...s.qs, ...r } };

/** legacy draw() 앞부분: quiz 화면이면 라운드를 보장하고(표현 모드는 제외), 남은 문장이 없으면 done. */
function settle(s: QuizData): Partial<QuizData> {
  if(s.view !== 'quiz') return {};
  let next = s;
  const a = activeRound(s);
  if(s.mode !== 'expr' && (!a.queue.length || a.cursor >= a.queue.length)) next = { ...s, ...withRound(s, newRound(a, passedOf(s), poolOf(s))) };
  const patch: Partial<QuizData> = next === s ? {} : { qs: next.qs, rev: next.rev };
  if(!activeRound(next).queue.length) patch.view = 'done';
  return patch;
}

/** legacy bumpWrong: 표현 모드는 기록하지 않고, 복습 중이면 완료 기록의 wrong, 아니면 진행 중 오답 횟수. */
function bumpWrong(s: QuizData, id: string, delta: number): Partial<QuizData> {
  if(s.mode === 'expr') return {};
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

export const initialQuizState = (): QuizData => ({
  qs: loadMain(), mode: 'main', rev: null, expr: null, view: 'quiz', cur: null, lis: null, lisRate: 1,
});

export function createQuizStore(initial: () => QuizData, opts: QuizStoreOptions = {}): QuizStore {
  return create<QuizState>()((set, get) => {
    /** 변경을 적용한 뒤 settle 까지 반영한다 (legacy 의 "상태 변경 → draw()") */
    const apply = (patch: Partial<QuizData>) => set(s => {
      const merged = { ...s, ...patch };
      return { ...patch, ...settle(merged) };
    });

    return {
      ...initial(),

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
        let patch: Partial<QuizData> = withRound(s, { results, cursor });
        if(cur.ok){
          if(s.mode === 'expr') patch = { expr: { ...patch.expr!, passed: { ...s.expr!.passed, [cur.id]: 1 } } };
          else if(s.mode === 'review') patch = { rev: { ...patch.rev!, passed: { ...s.rev!.passed, [cur.id]: 1 } } };
          else {
            const wrong = { ...s.qs.wrong };
            delete wrong[cur.id];
            patch = { qs: { ...patch.qs!, completed: { ...s.qs.completed, [cur.id]: { wrong: s.qs.wrong[cur.id] || 0 } }, wrong } };
          }
        }
        const end = cursor >= a.queue.length;
        apply({ ...patch, cur: null, lis: null, view: end ? (s.mode === 'expr' ? 'exprDone' : 'summary') : 'quiz' });
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

      exit: () => {
        const e = get().expr;
        if(!e) return;
        opts.onExit?.(e.results.filter(r => r.ok).length, e.queue.length);
      },
    };
  });
}

/** 퀴즈 탭의 전역 스토어 */
export const useQuizStore = createQuizStore(initialQuizState);

// legacy qSave: 진행 기록(qs)이 바뀔 때마다 저장한다. 복습·표현 연습 세션은 저장하지 않는다.
useQuizStore.subscribe((s, prev) => { if(s.qs !== prev.qs) saveMain(s.qs); });

/** 회화 탭의 표현 연습 초기 상태. 카드에 B1 문장이 없으면 null. */
export function exprQuizState(folderId: string, cardIndex: number, title: string, sub: string): QuizData | null {
  const queue = TENSES.map(t => `${folderId}|${cardIndex}|${t}`).filter(id => lookup(id));
  if(!queue.length) return null;
  return {
    qs: blankMain(), mode: 'expr', rev: null,
    expr: { queue, cursor: 0, results: [], round: 1, passed: {}, title, sub },
    view: 'quiz', cur: null, lis: null,
    lisRate: useQuizStore.getState().lisRate,   // 퀴즈 탭의 듣기 속도를 이어받는다
  };
}
```

- [ ] **Step 4: 확인 후 커밋**

Run: `npx vitest run src/features/quiz` → 30 passed (기존 26 + expr 4). `npm test` → 139 passed. `npx tsc --noEmit` → 출력 없음.

```bash
git add src/features/quiz/model.ts src/features/quiz/store.ts src/features/quiz/expr.test.ts
git commit -m "feat(quiz): 스토어를 팩토리로 바꾸고 표현 모드(4시제 연습) 추가"
```

---

### Task 2: 퀴즈 화면이 context의 스토어를 그리게 하고 표현 모드 화면 추가

**Files:**
- Create: `src/features/quiz/context.ts`, `src/features/quiz/exprView.test.tsx`
- Modify (전체 교체): `src/features/quiz/parts.tsx`, `src/features/quiz/views.tsx`, `src/features/quiz/QuizScreen.tsx`

- [ ] **Step 1: 테스트** — `src/features/quiz/exprView.test.tsx`

```tsx
import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../speech/tts', () => ({ speak: vi.fn(), whenVoicesReady: (cb: () => void) => cb() }));

import { QuizStoreContext } from './context';
import { QuizBody } from './QuizScreen';
import { createQuizStore, exprQuizState } from './store';

const FID = 'driving-on-the-road';
function renderExpr(onExit = vi.fn()) {
  const s = createQuizStore(() => exprQuizState(FID, 0, 'hit the road', '길을 떠나다, 출발하다')!, { onExit });
  render(<QuizStoreContext.Provider value={s}><QuizBody /></QuizStoreContext.Provider>);
  return { s, onExit };
}

beforeEach(() => localStorage.clear());

it('표현 모드 머리말: 표현·뜻·문장 수, 배지는 시제', () => {
  renderExpr();
  expect(document.querySelector('.qz-h1')?.textContent).toBe('hit the road길을 떠나다, 출발하다');
  expect(screen.getByText('문장 1 / 4')).toBeInTheDocument();
  expect(document.querySelector('.qz-round')?.textContent).toBe('현재형');
  expect(screen.queryByText(/완료 0 \//)).toBeNull();   // 퀴즈 탭의 완료함 칩은 없다
});

it('뒤로 가기와 마지막 화면의 "표현 목록으로"는 결과를 알려주며 나간다', () => {
  const { s, onExit } = renderExpr();
  fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
  expect(onExit).toHaveBeenLastCalledWith(0, 4);
  act(() => { for(let i = 0; i < 4; i++){ s.getState().submit('nope'); s.getState().next(); } });
  expect(screen.getByText('4문장 중 0문장 정답')).toBeInTheDocument();
  expect(screen.getByText('hit the road 연습을 마쳤어요.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '표현 목록으로' }));
  expect(onExit).toHaveBeenCalledTimes(2);
});
```

스토어를 테스트에서 직접 바꾸는 부분은 `act`로 감싸 화면 갱신이 끝난 뒤 확인한다.

Run: `npx vitest run src/features/quiz/exprView` → FAIL (`./context` 없음)

- [ ] **Step 2: `src/features/quiz/context.ts`**

```ts
import { createContext, useContext } from 'react';
import { useQuizStore, type QuizStore } from './store';

/** 퀴즈 화면이 그릴 스토어. 기본값은 퀴즈 탭의 전역 스토어, 회화의 표현 연습은 따로 만든 스토어를 넣는다. */
export const QuizStoreContext = createContext<QuizStore>(useQuizStore);
export const useQuiz = (): QuizStore => useContext(QuizStoreContext);
```

- [ ] **Step 3: `src/features/quiz/parts.tsx` 전체 교체**

```tsx
import { createElement, type ReactNode } from 'react';
import { exprWords, qNorm, variants } from '../../core/legacy/quiz-core.js';
import { speak } from '../../speech/tts';
import { useQuiz } from './context';
import { POOL, type Result } from './model';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** legacy highlightEn: 핵심 표현 단어(어형변화 포함)를 <mark> 로 */
export function markExpression(en: string, expression: string): ReactNode[] {
  const words: string[] = exprWords(expression);
  if(!words.length) return [en];
  const all = words.flatMap((w: string) => variants(w) as string[]).sort((a, b) => b.length - a.length).map(escapeRe);
  const re = new RegExp('\\b(' + all.join('|') + ')\\b', 'ig');
  return en.split(re).map((part, i) => (i % 2 ? createElement('mark', { key: i }, part) : part));
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

/** legacy headHTML: 표현 모드는 뒤로 가기·표현·문장 수, 그 외는 완료 진도와 완료함 칩 */
export function Head({ sub }: { sub: string }) {
  const st = useQuiz()();
  if(st.mode === 'expr' && st.expr){
    const e = st.expr, n = Math.min(e.cursor + 1, e.queue.length);
    return (
      <div className="qz-head">
        <button className="qz-back" id="qzExprBack" aria-label="뒤로" onClick={st.exit}>‹</button>
        <div className="qz-h1">{e.title}<span>{e.sub}</span></div>
        <div className="qz-hbar"><i style={{ width: (n / e.queue.length * 100).toFixed(1) + '%' }} /></div>
        <span className="qz-hchip">문장 {n} / {e.queue.length}</span>
      </div>
    );
  }
  const done = Object.keys(st.qs.completed).length;
  const pct = POOL.length ? done / POOL.length * 100 : 0;
  return (
    <div className="qz-head">
      <div className="qz-h1">영작 퀴즈<span>{sub}</span></div>
      <div className="qz-hbar"><i style={{ width: pct.toFixed(2) + '%' }} /></div>
      <button className="qz-hchip" onClick={() => st.go('completed')}>완료 {done} / {POOL.length} ›</button>
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

- [ ] **Step 4: `src/features/quiz/views.tsx` 전체 교체**

```tsx
import { useEffect, useState } from 'react';
import { useQuiz } from './context';
import { POOL, TENSE_LABEL, lookup, wrongIds } from './model';
import { Dots, Head, SpeakButton, Steps, dimExtra, markExpression } from './parts';
import { activeRound, type QuizState } from './store';

const subFor = (st: QuizState, sub: string) => (st.mode === 'review' ? '틀렸던 문장 복습' : sub);

export function QuestionView() {
  const st = useQuiz()();
  const [text, setText] = useState('');
  const a = activeRound(st);
  const it = lookup(a.queue[a.cursor] ?? '');
  if(!it) return null;
  // 표현 모드에선 라운드가 뜻이 없으니 시제를 보여준다
  const badge = st.mode === 'expr' ? TENSE_LABEL[it.tense] : st.mode === 'review' ? '복습' : '라운드 ' + a.round;
  const submit = () => st.submit(text);
  return (
    <>
      <Head sub={subFor(st, '한국어를 영어로 써 보세요')} />
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
  const st = useQuiz()();
  const cur = st.cur;
  if(!cur) return null;
  const { it, g, ok } = cur;
  return (
    <>
      <Head sub={subFor(st, '채점 결과')} />
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
  const st = useQuiz()();
  const { cur, lis, clearBad } = st;
  // 틀린 타일은 0.42초 동안만 붉게 (legacy badT). 틀릴 때마다 lis 가 새 객체라 타이머가 다시 시작된다.
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
      <Head sub={subFor(st, '듣고 순서 맞추기')} />
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
  const st = useQuiz()();
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
  const st = useQuiz()();
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

/** legacy exprDoneHTML */
export function ExprDoneView() {
  const st = useQuiz()();
  const e = st.expr;
  if(!e) return null;
  const okN = e.results.filter(r => r.ok).length;
  return (
    <>
      <Head sub="" />
      <div className="qz-done">
        <div className="e">{okN === e.queue.length ? '🎉' : '👏'}</div>
        <b>{e.queue.length}문장 중 {okN}문장 정답</b>
        <p>{e.title} 연습을 마쳤어요.</p>
      </div>
      <button className="qz-btn fill" id="qzExprEnd" onClick={st.exit}>표현 목록으로</button>
    </>
  );
}

export function CompletedView() {
  const st = useQuiz()();
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

- [ ] **Step 5: `src/features/quiz/QuizScreen.tsx` 전체 교체**

```tsx
import { useEffect } from 'react';
import { useQuiz } from './context';
import { activeRound } from './store';
import { CompletedView, DoneView, ExprDoneView, ListenView, QuestionView, ResultView, SummaryView } from './views';

/** legacy draw() 분기. context 의 스토어(퀴즈 탭 또는 표현 연습)를 그린다. */
export function QuizBody() {
  const useStore = useQuiz();
  const view = useStore(s => s.view);
  const open = useStore(s => s.open);
  const mode = useStore(s => s.mode);
  const round = useStore(s => activeRound(s).round);
  const cursor = useStore(s => activeRound(s).cursor);

  useEffect(() => { open(); }, [open]);
  useEffect(() => { window.scrollTo(0, 0); }, [view, cursor]);

  return (
    <>
      {view === 'quiz' && <QuestionView key={`${mode}-${round}-${cursor}`} />}
      {view === 'result' && <ResultView />}
      {view === 'listen' && <ListenView />}
      {view === 'summary' && <SummaryView />}
      {view === 'done' && <DoneView />}
      {view === 'exprDone' && <ExprDoneView />}
      {view === 'completed' && <CompletedView />}
    </>
  );
}

// legacy <div class="qz qzui" id="qzRoot">. context 기본값이 퀴즈 탭 스토어다.
export function QuizScreen() {
  return <div className="qz qzui" id="qzRoot"><QuizBody /></div>;
}
```

- [ ] **Step 6: 확인 후 커밋**

Run: `npx vitest run src/features/quiz` → 32 passed (기존 30 + exprView 2). 기존 `QuizScreen.test.tsx`, `store.test.ts`는 수정 없이 통과해야 한다.
Run: `npm test` → 141 passed. `npx tsc --noEmit` → 출력 없음.

```bash
git add src/features/quiz
git commit -m "feat(quiz): 퀴즈 화면을 context 스토어로 그리고 표현 연습 화면(머리말·완료) 추가"
```

---

### Task 3: 회화 데이터와 진도 스토어

**Files:**
- Create: `src/features/conv/data.ts`, `src/features/conv/data.test.ts`, `src/features/conv/store.ts`, `src/features/conv/store.test.ts`

- [ ] **Step 1: 테스트** — `src/features/conv/data.test.ts`

```ts
import { expect, it } from 'vitest';
import { CATS, FEMOJI, FOLDERS, TOTAL_CARDS, catFolders, catOf, searchFolders } from './data';

it('11개 카테고리가 46개 주제를 한 번씩 덮고, 모든 주제에 이모지가 있다', () => {
  expect(CATS).toHaveLength(11);
  const ids = CATS.flatMap(c => c.f);
  expect(ids).toHaveLength(46);
  expect(new Set(ids).size).toBe(46);
  expect(FOLDERS.every(f => ids.includes(f.id) && FEMOJI[f.id])).toBe(true);
  expect(TOTAL_CARDS).toBe(321);
});

it('주제 → 카테고리, 카테고리 → 주제', () => {
  expect(catOf('driving-on-the-road').id).toBe('travel');
  expect(catFolders(CATS[0]).map(f => f.id)).toEqual(CATS[0].f);
});

it('검색: 주제 이름, 표현(대소문자 무시), 뜻', () => {
  expect(searchFolders('')).toBe(FOLDERS);
  expect(searchFolders('HIT THE ROAD').map(f => f.id)).toContain('driving-on-the-road');
  expect(searchFolders('운전').map(f => f.id)).toContain('driving-on-the-road');
  expect(searchFolders('출발하다').map(f => f.id)).toContain('driving-on-the-road');
  expect(searchFolders('zzzz-none')).toEqual([]);
});
```

Run: `npx vitest run src/features/conv/data` → FAIL

- [ ] **Step 2: `src/features/conv/data.ts`** (legacy `FEMOJI`, `CATS`, `catOf`, `catFolders`, `searchFolders`를 그대로)

```ts
import conv from '../../data/conv.json';

export type Folder = (typeof conv.folders)[number];
export type Card = Folder['cards'][number];
export interface Cat { id: string; name: string; emoji: string; g: [string, string]; f: string[] }

export const FOLDERS: Folder[] = conv.folders;
export const TOTAL_CARDS = FOLDERS.reduce((a, f) => a + f.cards.length, 0);

/* 46개 주제를 11개 카테고리로 묶는다. 카드 이미지가 없으므로
   카테고리별 그라데이션 + 주제별 이모지로 대신한다. (legacy 그대로) */
export const FEMOJI: Record<string, string> = {
  'driving-on-the-road': '🚗', 'gym-and-workout': '🏋️', 'moving-and-housewarming': '📦',
  'cafe-and-ordering': '☕', 'business-meetings-conferences': '💼', 'banking-account-phrases': '🏦',
  'grocery-shopping-phrases': '🛒', 'doctor-pharmacy-phrases': '🏥', 'hair-salon-phrases': '✂️',
  'soothing-a-baby': '👶', 'bar-and-drinks': '🍻', 'watching-sports-game': '🏟️',
  'scrolling-social-media': '📱', 'relaxing-at-home': '🛋️', 'concert-and-show': '🎤',
  'evening-routine': '🌙', 'dog-care-routine': '🐕', 'korean-holiday-ancestral-rites': '🎎',
  'casual-agreement-replies': '👌', 'decorating-the-home': '🪴', 'at-the-airport': '✈️',
  'wedding-engagement': '💍', 'studying-and-learning': '📚', 'small-talk-questions-answers': '💬',
  'reading-books': '📖', 'wrapping-up-work-tasks': '📝', 'booking-and-packing': '🧳',
  'birthday-celebrations': '🎂', 'team-collaboration-talk': '🤝', 'cooking-and-meals': '🍳',
  'weekend-getaway-travel': '🏖️', 'small-talk-greetings': '👋', 'using-public-transit': '🚇',
  'sightseeing-and-travel': '🗺️', 'morning-routine': '☀️', 'car-rental': '🚙',
  'running-and-marathon': '🏃', 'ordering-at-a-restaurant': '🍽️', 'morning-grooming-routine': '🪥',
  'shopping-store-phrases': '🛍️', 'at-the-hotel': '🏨', 'tidying-up': '🧹',
  'christmas-celebration': '🎄', 'dating-and-relationships': '💖', 'weekend-routine': '🧺',
  'movie-theater-phrases': '🎬',
};

export const CATS: Cat[] = [
  { id: 'routine', name: '일상 루틴', emoji: '☀️', g: ['#FFF4DA', '#FFE2AE'],
    f: ['morning-routine', 'morning-grooming-routine', 'evening-routine', 'weekend-routine', 'relaxing-at-home', 'tidying-up'] },
  { id: 'home', name: '집과 살림', emoji: '🏠', g: ['#EAF4EE', '#CDE6D9'],
    f: ['moving-and-housewarming', 'decorating-the-home', 'cooking-and-meals', 'grocery-shopping-phrases'] },
  { id: 'eat', name: '먹고 마시기', emoji: '☕', g: ['#FAE8DB', '#F2CFB3'],
    f: ['cafe-and-ordering', 'ordering-at-a-restaurant', 'bar-and-drinks'] },
  { id: 'travel', name: '여행', emoji: '✈️', g: ['#E5EFFC', '#C6DCF7'],
    f: ['at-the-airport', 'at-the-hotel', 'sightseeing-and-travel', 'booking-and-packing', 'car-rental', 'weekend-getaway-travel', 'using-public-transit', 'driving-on-the-road'] },
  { id: 'health', name: '운동과 건강', emoji: '🏃', g: ['#E7F7F0', '#BEEDD9'],
    f: ['gym-and-workout', 'running-and-marathon', 'doctor-pharmacy-phrases', 'watching-sports-game'] },
  { id: 'work', name: '일과 비즈니스', emoji: '💼', g: ['#EDEEF7', '#D3D6EE'],
    f: ['business-meetings-conferences', 'wrapping-up-work-tasks', 'team-collaboration-talk', 'banking-account-phrases'] },
  { id: 'social', name: '관계와 대화', emoji: '💬', g: ['#FDE9EE', '#F7CBD9'],
    f: ['small-talk-questions-answers', 'small-talk-greetings', 'casual-agreement-replies', 'dating-and-relationships'] },
  { id: 'event', name: '기념일과 행사', emoji: '🎉', g: ['#F4EAFB', '#DFC9F4'],
    f: ['wedding-engagement', 'birthday-celebrations', 'korean-holiday-ancestral-rites', 'christmas-celebration'] },
  { id: 'leisure', name: '여가와 취미', emoji: '🎬', g: ['#FFEFE4', '#FFD5BB'],
    f: ['scrolling-social-media', 'concert-and-show', 'reading-books', 'movie-theater-phrases', 'studying-and-learning'] },
  { id: 'care', name: '돌봄', emoji: '🐾', g: ['#EAF6F9', '#C9E6EF'],
    f: ['soothing-a-baby', 'dog-care-routine'] },
  { id: 'shop', name: '쇼핑과 관리', emoji: '🛍️', g: ['#F1F3EA', '#DCE2C9'],
    f: ['shopping-store-phrases', 'hair-salon-phrases'] },
];

export const fById = (id: string): Folder | undefined => FOLDERS.find(f => f.id === id);
export const catById = (id: string): Cat | undefined => CATS.find(c => c.id === id);
export const catOf = (fid: string): Cat => CATS.find(c => c.f.includes(fid)) ?? CATS[0];
export const catFolders = (c: Cat): Folder[] => c.f.map(fById).filter((f): f is Folder => !!f);

/** legacy searchFolders: 주제 이름·표현은 대소문자 무시, 뜻은 그대로 비교 */
export function searchFolders(q: string): Folder[] {
  if(!q) return FOLDERS;
  const ql = q.toLowerCase();
  return FOLDERS.filter(f => f.titleKo.toLowerCase().includes(ql)
    || f.cards.some(c => c.expression.toLowerCase().includes(ql) || (c.meaningKo || '').includes(q)));
}
```

Run: `npx vitest run src/features/conv/data` → 3 passed

- [ ] **Step 3: 테스트** — `src/features/conv/store.test.ts`

```ts
import { beforeEach, expect, it } from 'vitest';
import { FOLDERS } from './data';
import { folderDone, initialConvState, isDone, isMark, loadProgress, useConvStore } from './store';

const st = () => useConvStore.getState();
const saved = () => JSON.parse(localStorage.getItem('elab_progress_v1') || 'null');

beforeEach(() => { localStorage.clear(); useConvStore.setState(initialConvState()); });

it('legacy 가 저장한 elab_progress_v1 을 읽는다 (없거나 깨지면 빈 진도)', () => {
  expect(loadProgress()).toEqual({ done: {}, marks: {}, reveal: false });
  localStorage.setItem('elab_progress_v1', JSON.stringify({ done: { 'a#0': 1 }, marks: { 'b#2': 1 }, reveal: true }));
  expect(loadProgress()).toEqual({ done: { 'a#0': 1 }, marks: { 'b#2': 1 }, reveal: true });
  localStorage.setItem('elab_progress_v1', '{oops');
  expect(loadProgress()).toEqual({ done: {}, marks: {}, reveal: false });
});

it('완료·북마크 토글은 legacy 와 같은 키("주제#번호")와 형식으로 저장한다', () => {
  const f = FOLDERS[0];
  st().toggleDone(f.id, 0);
  st().toggleMark(f.id, 2);
  expect(saved()).toEqual({ done: { [`${f.id}#0`]: 1 }, marks: { [`${f.id}#2`]: 1 }, reveal: false });
  expect(isDone(st().progress, f.id, 0)).toBe(true);
  expect(isMark(st().progress, f.id, 2)).toBe(true);
  expect(folderDone(st().progress, f)).toBe(1);
  st().toggleDone(f.id, 0);
  expect(saved().done).toEqual({});
});

it('기록 초기화는 완료·북마크만 지우고 reveal 은 그대로 둔다', () => {
  localStorage.setItem('elab_progress_v1', JSON.stringify({ done: { 'a#0': 1 }, marks: { 'a#1': 1 }, reveal: true }));
  useConvStore.setState(initialConvState());
  st().resetProgress();
  expect(saved()).toEqual({ done: {}, marks: {}, reveal: true });
});

it('토스트는 같은 문구여도 다시 띄울 수 있다', () => {
  st().showToast('안녕');
  const n = st().toast.n;
  st().showToast('안녕');
  expect(st().toast).toEqual({ msg: '안녕', n: n + 1, show: true });
  st().hideToast();
  expect(st().toast.show).toBe(false);
  expect(st().toast.msg).toBe('안녕');   // 사라지는 동안 문구 유지
});
```

Run: `npx vitest run src/features/conv/store` → FAIL

- [ ] **Step 4: `src/features/conv/store.ts`**

```ts
import { create } from 'zustand';
import { LS_KEYS } from '../../storage/keys';
import { lsGetJSON, lsSetJSON } from '../../storage/local';
import type { Folder } from './data';

/** legacy elab_progress_v1 과 같은 형식. reveal 은 지금 쓰지 않지만 보존한다. */
export interface Progress { done: Record<string, 1>; marks: Record<string, 1>; reveal: boolean }
export type ConvView =
  | { name: 'home' } | { name: 'marks' }
  | { name: 'cat'; cid: string } | { name: 'folder'; fid: string } | { name: 'card'; fid: string; idx: number };
export interface Toast { msg: string; n: number; show: boolean }

export const ckey = (fid: string, idx: number): string => fid + '#' + idx;
export const isDone = (p: Progress, fid: string, idx: number): boolean => !!p.done[ckey(fid, idx)];
export const isMark = (p: Progress, fid: string, idx: number): boolean => !!p.marks[ckey(fid, idx)];
export const folderDone = (p: Progress, f: Folder): number => f.cards.filter((_, i) => isDone(p, f.id, i)).length;

export function loadProgress(): Progress {
  const s = lsGetJSON<Partial<Progress> | null>(LS_KEYS.progress, {}) ?? {};
  return { done: s.done || {}, marks: s.marks || {}, reveal: !!s.reveal };
}

function toggle(map: Record<string, 1>, key: string): Record<string, 1> {
  const out = { ...map };
  if(out[key]) delete out[key]; else out[key] = 1;
  return out;
}

interface Data { progress: Progress; view: ConvView; searchQ: string; toast: Toast }
interface Actions {
  nav(view: ConvView): void;
  setSearch(q: string): void;
  toggleDone(fid: string, idx: number): void;
  toggleMark(fid: string, idx: number): void;
  resetProgress(): void;
  showToast(msg: string): void;
  hideToast(): void;
}

export const initialConvState = (): Data => ({
  progress: loadProgress(), view: { name: 'home' }, searchQ: '', toast: { msg: '', n: 0, show: false },
});

export const useConvStore = create<Data & Actions>()(set => ({
  ...initialConvState(),
  nav: view => set({ view }),
  setSearch: searchQ => set({ searchQ }),
  toggleDone: (fid, idx) => set(s => ({ progress: { ...s.progress, done: toggle(s.progress.done, ckey(fid, idx)) } })),
  toggleMark: (fid, idx) => set(s => ({ progress: { ...s.progress, marks: toggle(s.progress.marks, ckey(fid, idx)) } })),
  resetProgress: () => set(s => ({ progress: { ...s.progress, done: {}, marks: {} } })),
  showToast: msg => set(s => ({ toast: { msg, n: s.toast.n + 1, show: true } })),
  hideToast: () => set(s => ({ toast: { ...s.toast, show: false } })),
}));

// legacy saveState: 진도가 바뀔 때마다 저장
useConvStore.subscribe((s, prev) => { if(s.progress !== prev.progress) lsSetJSON(LS_KEYS.progress, s.progress); });
```

Run: `npx vitest run src/features/conv` → 7 passed. `npx tsc --noEmit` → 출력 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/features/conv
git commit -m "feat(conv): 회화 카테고리 데이터와 진도 스토어 (elab_progress_v1 유지)"
```

---

### Task 4: 회화 화면

legacy `homeHTML`, `folderTileHTML`, `catHTML`, `headHTML`, `marksHTML`, `folderHTML`, `cardHTML`/`bindCard`, `ring`, `toast`를 같은 class 이름의 JSX로 옮긴다. legacy의 `<sm>` 태그는 CSS(`.pmeta sm`)가 쓰므로 그대로 만든다. 검색창은 React가 입력 중 포커스를 유지하므로 legacy의 포커스 복원 코드가 필요 없다.

**Files:**
- Create: `src/features/conv/views.tsx`, `src/features/conv/ConvScreen.tsx`, `src/features/conv/ConvScreen.test.tsx`
- Modify: `src/app/screens.tsx`

- [ ] **Step 1: 테스트** — `src/features/conv/ConvScreen.test.tsx`

```tsx
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../speech/tts', () => ({ speak: vi.fn(), whenVoicesReady: (cb: () => void) => cb() }));

import { ConvScreen } from './ConvScreen';
import { initialConvState, useConvStore } from './store';

const FID = 'driving-on-the-road', TITLE = '운전과 도로 위 표현';

beforeEach(() => { localStorage.clear(); useConvStore.setState(initialConvState()); });

it('홈: 전체 진도, 카테고리 11개, 검색', () => {
  render(<ConvScreen />);
  expect(document.querySelector('.pbig')?.textContent).toBe('0 / 321 표현 완료');
  expect(document.querySelectorAll('.cv-sec')).toHaveLength(11);
  const search = screen.getByPlaceholderText('주제나 표현 검색 (예: 샤워, shower)');
  fireEvent.change(search, { target: { value: 'hit the road' } });
  expect(screen.getByText(/^검색 결과 \d+개$/)).toBeInTheDocument();
  expect(screen.getByText(TITLE)).toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'zzzz-none' } });
  expect(screen.getByText('검색 결과가 없어요.')).toBeInTheDocument();
});

it('카테고리 모두 보기 → 주제 → 완료·북마크 → 북마크 목록', () => {
  render(<ConvScreen />);
  fireEvent.click(screen.getAllByRole('button', { name: '모두 보기' })[3]);   // 여행
  expect(document.querySelector('.cv-htitle')?.textContent).toContain('✈️ 여행');
  fireEvent.click(screen.getByText(TITLE));
  expect(document.querySelector('.fhead h2')?.textContent).toBe(TITLE);
  fireEvent.click(screen.getAllByRole('button', { name: '완료 표시' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: '북마크' })[0]);
  expect(JSON.parse(localStorage.getItem('elab_progress_v1')!)).toEqual({
    done: { [`${FID}#0`]: 1 }, marks: { [`${FID}#0`]: 1 }, reveal: false,
  });
  expect(document.querySelector('.fh-prog')?.textContent).toMatch(/^1 \/ \d+ 완료/);
  fireEvent.click(screen.getByRole('button', { name: '‹' }));
  fireEvent.click(screen.getByRole('button', { name: '★ 북마크 1' }));
  expect(screen.getByText('hit the road')).toBeInTheDocument();
  expect(document.querySelector('.mfolder')?.textContent).toBe(TITLE);
});

it('legacy 진도를 그대로 보여 주고 초기화는 확인 후에만', () => {
  localStorage.setItem('elab_progress_v1', JSON.stringify({ done: { [`${FID}#0`]: 1 }, marks: {}, reveal: true }));
  useConvStore.setState(initialConvState());
  render(<ConvScreen />);
  expect(document.querySelector('.pbig')?.textContent).toBe('1 / 321 표현 완료');
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: '학습 기록 초기화' }));
  expect(document.querySelector('.pbig')?.textContent).toBe('1 / 321 표현 완료');
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: '학습 기록 초기화' }));
  expect(document.querySelector('.pbig')?.textContent).toBe('0 / 321 표현 완료');
  expect(document.querySelector('#convToast')?.textContent).toBe('학습 기록을 초기화했어요');
  expect(JSON.parse(localStorage.getItem('elab_progress_v1')!).reveal).toBe(true);
  confirm.mockRestore();
});

it('표현 연습: 4시제 퀴즈, 뒤로 가면 주제 화면과 결과 토스트, 퀴즈 탭 기록은 그대로', () => {
  useConvStore.setState({ view: { name: 'card', fid: FID, idx: 0 } });
  render(<ConvScreen />);
  expect(document.querySelector('#cvQuizRoot .qz-h1')?.textContent).toContain('hit the road');
  expect(screen.getByText('문장 1 / 4')).toBeInTheDocument();
  expect(document.querySelector('.qz-round')?.textContent).toBe('현재형');
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  expect(screen.getByText('✗ 다시 확인해 보세요')).toBeInTheDocument();
  expect(localStorage.getItem('elab_quiz_v1')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
  expect(document.querySelector('.fhead h2')?.textContent).toBe(TITLE);
  expect(document.querySelector('#convToast')?.textContent).toBe('4문장 중 0문장 정답');
});
```

Run: `npx vitest run src/features/conv/ConvScreen` → FAIL

- [ ] **Step 2: `src/features/conv/views.tsx`**

```tsx
import { createElement, useState, type ReactNode } from 'react';
import { QuizStoreContext } from '../quiz/context';
import { QuizBody } from '../quiz/QuizScreen';
import { createQuizStore, exprQuizState } from '../quiz/store';
import { CATS, FEMOJI, FOLDERS, TOTAL_CARDS, catById, catFolders, catOf, fById, searchFolders, type Folder } from './data';
import { folderDone, isDone, isMark, useConvStore } from './store';

/** legacy 는 <sm> 태그를 쓰고 CSS 가 그것을 꾸민다 */
const Sm = ({ children }: { children: ReactNode }) => createElement('sm', null, children);

/** legacy ring() */
export function Ring({ pct, size, sw, color }: { pct: number; size: number; sw: number; color: string }) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100), h = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={h} cy={h} r={r} fill="none" stroke="var(--cv-line)" strokeWidth={sw} />
      <circle cx={h} cy={h} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform={`rotate(-90 ${h} ${h})`} />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="ringtxt"
        style={{ fontSize: (size * 0.27).toFixed(0) + 'px' }}>{Math.round(pct)}%</text>
    </svg>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  const nav = useConvStore(s => s.nav);
  return (
    <div className="cv-head">
      <button className="cv-back" onClick={() => nav({ name: 'home' })}>‹</button>
      <div className="cv-htitle">{title}<span>{sub}</span></div>
    </div>
  );
}

function FolderTile({ f }: { f: Folder }) {
  const progress = useConvStore(s => s.progress);
  const nav = useConvStore(s => s.nav);
  const d = folderDone(progress, f), pct = f.cards.length ? d / f.cards.length * 100 : 0, full = d === f.cards.length;
  const c = catOf(f.id);
  return (
    <button className={'ftile' + (full ? ' done' : '')} onClick={() => nav({ name: 'folder', fid: f.id })}>
      <span className="fimg" style={{ background: `linear-gradient(145deg,${c.g[0]},${c.g[1]})` }}>
        <span className="fe">{FEMOJI[f.id] || '💬'}</span>
        {full && <span className="fdone">✓</span>}
      </span>
      <span className="ftitle">{f.titleKo}</span>
      <span className="fbar"><i style={{ width: pct + '%' }} /></span>
      <span className="fprog">{full ? '완료!' : `${d} / ${f.cards.length}`}</span>
    </button>
  );
}

export function HomeView() {
  const { progress, searchQ, setSearch, nav, resetProgress, showToast } = useConvStore();
  const done = Object.keys(progress.done).length;
  const pct = TOTAL_CARDS ? done / TOTAL_CARDS * 100 : 0;
  const doneFolders = FOLDERS.filter(f => folderDone(progress, f) === f.cards.length).length;
  const found = searchQ ? searchFolders(searchQ) : null;
  const reset = () => {
    if(!window.confirm('모든 회화 학습 완료·북마크 기록을 지울까요?')) return;
    resetProgress();
    showToast('학습 기록을 초기화했어요');
  };
  return (
    <>
      <div className="cv-hero"><h1 className="serif">오늘의 회화 연습</h1><p>주제를 고르고, 한국어를 영어로 말해 보세요.</p></div>
      <div className="psum">
        <div><Ring pct={pct} size={70} sw={8} color="var(--cv-teal)" /></div>
        <div className="ptxt">
          <div className="pbig">{done}<small> / {TOTAL_CARDS} 표현 완료</small></div>
          <div className="plabel">전체 학습 진도</div>
          <div className="pmeta"><Sm>완료한 주제 <b>{doneFolders}</b> / {FOLDERS.length}</Sm><Sm>남은 표현 <b>{TOTAL_CARDS - done}</b></Sm></div>
        </div>
      </div>
      <div className="homechips">
        <button className="cv-chip star" id="convBm" onClick={() => nav({ name: 'marks' })}>★ 북마크 {Object.keys(progress.marks).length}</button>
        <span className="cv-chip dim">✓ 완료 {done}</span>
      </div>
      <div className="searchwrap">
        <i>⌕</i>
        <input id="convSearch" type="search" placeholder="주제나 표현 검색 (예: 샤워, shower)" value={searchQ} onChange={e => setSearch(e.target.value)} />
      </div>
      {found ? (
        <>
          <div className="sectlabel">검색 결과 {found.length}개</div>
          {found.length
            ? <div className="fgrid">{found.map(f => <FolderTile key={f.id} f={f} />)}</div>
            : <div className="cv-empty">검색 결과가 없어요.</div>}
        </>
      ) : CATS.map(c => {
        const fs = catFolders(c);
        if(!fs.length) return null;
        return (
          <div key={c.id} className="cv-sec">
            <div className="cv-sechead">
              <b><span className="ce">{c.emoji}</span>{c.name}</b>
              <button className="cv-more" onClick={() => nav({ name: 'cat', cid: c.id })}>모두 보기</button>
            </div>
            <div className="cv-row">{fs.map(f => <FolderTile key={f.id} f={f} />)}</div>
          </div>
        );
      })}
      <div className="cv-foot"><button id="convReset" onClick={reset}>학습 기록 초기화</button></div>
    </>
  );
}

export function CatView({ cid }: { cid: string }) {
  const progress = useConvStore(s => s.progress);
  const c = catById(cid);
  if(!c) return null;
  const fs = catFolders(c);
  const d = fs.reduce((a, f) => a + folderDone(progress, f), 0), t = fs.reduce((a, f) => a + f.cards.length, 0);
  return (
    <>
      <Head title={`${c.emoji} ${c.name}`} sub={`주제 ${c.f.length}개 · 표현 ${d} / ${t} 완료`} />
      <div className="fgrid">{fs.map(f => <FolderTile key={f.id} f={f} />)}</div>
    </>
  );
}

function ExprRow({ f, i, showFolder }: { f: Folder; i: number; showFolder?: boolean }) {
  const { progress, toggleDone, toggleMark, nav } = useConvStore();
  const c = f.cards[i], on = isDone(progress, f.id, i), mk = isMark(progress, f.id, i);
  return (
    <div className="erow">
      <button className={'echeck' + (on ? ' on' : '')} aria-label="완료 표시" onClick={e => { e.stopPropagation(); toggleDone(f.id, i); }}>{on ? '✓' : ''}</button>
      <div className="ebody" onClick={() => nav({ name: 'card', fid: f.id, idx: i })}>
        {showFolder && <div className="mfolder">{f.titleKo}</div>}
        <div className="eexp">{c.expression}</div>
        <div className="emean">{c.meaningKo}</div>
      </div>
      <button className={'estar' + (mk ? ' on' : '')} aria-label="북마크" onClick={e => { e.stopPropagation(); toggleMark(f.id, i); }}>{mk ? '★' : '☆'}</button>
      <div className="echev">›</div>
    </div>
  );
}

export function MarksView() {
  const progress = useConvStore(s => s.progress);
  const items: Array<{ f: Folder; i: number }> = [];
  FOLDERS.forEach(f => f.cards.forEach((_, i) => { if(isMark(progress, f.id, i)) items.push({ f, i }); }));
  return (
    <>
      <Head title="북마크한 표현" sub={`${Object.keys(progress.marks).length}개`} />
      {items.length ? (
        <>
          <div className="sectlabel">북마크 {items.length}개</div>
          {items.map(o => <ExprRow key={`${o.f.id}#${o.i}`} f={o.f} i={o.i} showFolder />)}
        </>
      ) : (
        <div className="cv-empty"><span className="big">★</span>북마크한 표현이 아직 없어요.<br />표현 상세 화면에서 ★ 버튼을 눌러 저장하세요.</div>
      )}
    </>
  );
}

export function FolderView({ fid }: { fid: string }) {
  const progress = useConvStore(s => s.progress);
  const f = fById(fid);
  if(!f) return null;
  const d = folderDone(progress, f), pct = f.cards.length ? d / f.cards.length * 100 : 0;
  return (
    <>
      <Head title={f.titleKo} sub={`${d} / ${f.cards.length} 완료`} />
      <div className="fhead">
        <h2 className="serif">{f.titleKo}</h2>
        <div className="fh-meta">표현 {f.cards.length}개 · 표현별 A2·B1·B2 시제 연습</div>
        <div className="fbar"><i style={{ width: pct + '%' }} /></div>
        <div className="fh-prog"><span><b>{d}</b> / {f.cards.length} 완료</span><span>{Math.round(pct)}%</span></div>
      </div>
      <div className="sectlabel">표현 목록</div>
      {f.cards.map((_, i) => <ExprRow key={i} f={f} i={i} />)}
    </>
  );
}

/** legacy cardHTML + bindCard: 표현 하나를 4시제 퀴즈로. 퀴즈 탭 진도에는 반영하지 않는다. */
export function CardView({ fid, idx }: { fid: string; idx: number }) {
  const nav = useConvStore(s => s.nav);
  const showToast = useConvStore(s => s.showToast);
  const [store] = useState(() => {
    const c = fById(fid)?.cards[idx];
    const init = c ? exprQuizState(fid, idx, c.expression, c.meaningKo) : null;
    if(!init) return null;
    return createQuizStore(() => init, {
      // 완료 체크는 목록에서 직접 누르도록 둔다 (자동으로 표시하지 않음)
      onExit: (okN, total) => { nav({ name: 'folder', fid }); showToast(`${total}문장 중 ${okN}문장 정답`); },
    });
  });
  if(!store) return <div className="cv-empty">퀴즈를 불러오지 못했어요.</div>;
  return (
    <div className="qz qzui" id="cvQuizRoot">
      <QuizStoreContext.Provider value={store}><QuizBody /></QuizStoreContext.Provider>
    </div>
  );
}
```

- [ ] **Step 3: `src/features/conv/ConvScreen.tsx`**

```tsx
import { useEffect } from 'react';
import { useConvStore } from './store';
import { CardView, CatView, FolderView, HomeView, MarksView } from './views';

// legacy <div class="cv-toast" id="convToast"> + <div class="conv" id="convRoot"> 와 draw() 분기
export function ConvScreen() {
  const view = useConvStore(s => s.view);
  const toast = useConvStore(s => s.toast);
  const hideToast = useConvStore(s => s.hideToast);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);
  useEffect(() => {
    if(!toast.show) return;
    const t = setTimeout(hideToast, 1800);
    return () => clearTimeout(t);
  }, [toast.n, toast.show, hideToast]);

  return (
    <>
      <div className={'cv-toast' + (toast.show ? ' show' : '')} id="convToast">{toast.msg}</div>
      <div className="conv" id="convRoot">
        {view.name === 'home' && <HomeView />}
        {view.name === 'cat' && <CatView cid={view.cid} />}
        {view.name === 'marks' && <MarksView />}
        {view.name === 'folder' && <FolderView fid={view.fid} />}
        {view.name === 'card' && <CardView key={`${view.fid}#${view.idx}`} fid={view.fid} idx={view.idx} />}
      </div>
    </>
  );
}
```

- [ ] **Step 4: 회화 탭에 연결** — `src/app/screens.tsx`

import를 추가하고 `conv` 줄을 바꾼다.

```tsx
import { ConvScreen } from '../features/conv/ConvScreen';
```

```tsx
  conv: { id: 'screen-conv', inMain: true, render: () => <ConvScreen /> },
```

- [ ] **Step 5: 확인 후 커밋**

Run: `npx vitest run src/features/conv` → 11 passed (data 3 + store 4 + screen 4). 5번 반복해서 흔들리지 않는지 확인한다.
Run: `npm test` → 152 passed. `npx tsc --noEmit` → 출력 없음. `npm run build` → 에러 없음.

```bash
git add src/features/conv src/app/screens.tsx
git commit -m "feat(conv): 회화 탭 이관 (홈·카테고리·주제·북마크·표현 4시제 연습)"
```

---

### Task 5: legacy와 나란히 비교 확인

- [ ] **Step 1: 두 앱 띄우기**

- 새 앱: `npm run dev` → `http://localhost:5173`
- legacy: `python -m http.server 8124 -d legacy` → `http://localhost:8124`

- [ ] **Step 2: 확인 항목** (회화 탭, 모바일 375px 폭)

1. 홈: 히어로, 진도 링, 완료한 주제·남은 표현, 북마크·완료 칩, 검색창, 11개 카테고리 가로 스크롤 줄과 타일(그라데이션·이모지·진도 막대)이 legacy와 같다.
2. 검색: 한글 주제명, 영어 표현(대소문자 무시), 뜻으로 찾고, 입력 중 포커스가 유지된다.
3. 카테고리 "모두 보기", 주제 화면(머리말, 진도, 표현 목록), 완료 체크·북마크 토글, 북마크 목록.
4. 표현을 누르면 4시제 퀴즈(머리말 뒤로 가기·표현·뜻·문장 수, 시제 배지). 뒤로 가기나 마지막 "표현 목록으로"에서 주제 화면으로 돌아오고 "4문장 중 N문장 정답" 토스트.
5. 표현 연습을 한 뒤 퀴즈 탭으로 가면 퀴즈 탭 진행 화면이 그대로다(legacy는 초기화됨, 의도한 개선).
6. **저장 형식:** 새 앱에서 완료·북마크를 몇 개 한 뒤 `localStorage.elab_progress_v1`을 legacy(8124)에 넣고 새로고침하면 같은 진도·북마크가 보인다. 반대 방향도 확인.
7. 기록 초기화: 확인 창, 토스트, `reveal` 값 보존.

- [ ] **Step 3: 푸시와 미리보기 확인**

```bash
git push
```

미리보기 주소에서 회화 탭 1~5를 다시 확인한다.
