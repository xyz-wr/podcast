import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../speech/tts', () => ({ speak: vi.fn(), whenVoicesReady: (cb: () => void) => cb() }));

import { speak } from '../../speech/tts';
import { POOL, grade, lookup } from './model';
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
  // legacy 채점은 불규칙 동사 등으로 모범 답안 자체를 거절하는 문장이 있다 → 통과하는 문장으로 고정
  const okId = POOL.find(p => { const x = lookup(p)!; return grade(x.en, x).ok; })!;
  useQuizStore.setState({ qs: { ...useQuizStore.getState().qs, queue: [okId, POOL.find(p => p !== okId)!], cursor: 0, results: [] } });
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
