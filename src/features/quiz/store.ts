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
