import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../speech/tts', () => ({
  speak: vi.fn(),
  whenVoicesReady: (cb: () => void) => cb(),
}));

import { speak } from '../../speech/tts';
import { POOL, grade, lookup } from './model';
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
  // legacy 채점은 표현이 불규칙 활용(made, laid ...)이면 모범 답안도 오답 처리한다(1284문장 중 227). 모범 답안이 통과하는 문장으로 고정한다.
  const okId = POOL.find(p => { const x = lookup(p)!; return grade(x.en, x).ok; })!;
  useQuizStore.setState({ qs: { ...st().qs, queue: [okId, POOL.find(p => p !== okId)!], cursor: 0, results: [] } });
  st().open();
  const id = okId;
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
