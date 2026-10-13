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
