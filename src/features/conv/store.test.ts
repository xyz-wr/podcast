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
