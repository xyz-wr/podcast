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
