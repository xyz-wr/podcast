import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DialogHost } from './DialogHost';
import { askConfirm, askText, closeDialog, toast, useUiStore } from './store';

beforeEach(() => useUiStore.setState({ dialog: null, toast: { msg: '', n: 0, show: false } }));
afterEach(() => vi.useRealTimers());

it('확인창: 확인 → true, 취소 → false, 바깥 클릭 → false', async () => {
  render(<DialogHost />);
  let p = askConfirm('영상 삭제', '정말요?');
  await act(async () => {});
  expect(document.querySelector('#confirmModal')).toHaveClass('show');
  expect(screen.getByText('정말요?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  await expect(p).resolves.toBe(true);
  expect(document.querySelector('#confirmModal')).not.toHaveClass('show');

  p = askConfirm('폴더 삭제', '폴더요?', '지우기', '📁');
  await act(async () => {});
  expect(screen.getByText('📁')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  await expect(p).resolves.toBe(false);

  p = askConfirm('a', 'b');
  await act(async () => {});
  fireEvent.click(document.querySelector('#confirmModal')!);
  await expect(p).resolves.toBe(false);
});

it('입력창: Enter·확인은 앞뒤 공백을 뺀 값, 취소는 null', async () => {
  render(<DialogHost />);
  let p = askText('새 폴더', '', '폴더 이름', '만들기');
  await act(async () => {});
  const input = screen.getByPlaceholderText('폴더 이름');
  fireEvent.change(input, { target: { value: '  여행  ' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await expect(p).resolves.toBe('여행');

  p = askText('폴더 이름', '기존', '', '저장');
  await act(async () => {});
  expect(screen.getByDisplayValue('기존')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await expect(p).resolves.toBe('기존');

  p = askText('x');
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  await expect(p).resolves.toBeNull();
});

it('창이 떠 있을 때 새 창을 열면 앞의 것은 취소로 끝난다', async () => {
  const first = askConfirm('a', 'b');
  const second = askText('c');
  await expect(first).resolves.toBe(false);
  closeDialog(null);
  await expect(second).resolves.toBeNull();
});

it('토스트는 1.8초 뒤 사라지고, 다시 띄우면 시간을 새로 센다', () => {
  vi.useFakeTimers();
  render(<DialogHost />);
  act(() => toast('저장됨'));
  expect(document.querySelector('#toast')).toHaveClass('show');
  expect(document.querySelector('#toast')?.textContent).toBe('저장됨');
  act(() => { vi.advanceTimersByTime(1500); toast('다시'); });
  act(() => { vi.advanceTimersByTime(1500); });
  expect(document.querySelector('#toast')).toHaveClass('show');
  act(() => { vi.advanceTimersByTime(400); });
  expect(document.querySelector('#toast')).not.toHaveClass('show');
});
