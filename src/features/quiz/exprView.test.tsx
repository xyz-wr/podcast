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
