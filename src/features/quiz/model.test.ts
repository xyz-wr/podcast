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
