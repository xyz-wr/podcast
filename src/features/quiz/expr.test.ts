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
