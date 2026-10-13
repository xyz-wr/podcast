import { beforeEach, expect, it, vi } from 'vitest';
import { lsGetJSON, lsGetRaw, lsSetJSON, lsSetRaw } from './local';

beforeEach(() => localStorage.clear());

it('문자열을 그대로 읽고 쓴다', () => {
  lsSetRaw('elab_tab', 'voca');
  expect(localStorage.getItem('elab_tab')).toBe('voca');
  expect(lsGetRaw('elab_tab')).toBe('voca');
});

it('JSON 은 기존 앱처럼 JSON.stringify 로 저장한다', () => {
  lsSetJSON('elab_quiz_v1', { a: 1 });
  expect(localStorage.getItem('elab_quiz_v1')).toBe('{"a":1}');
  expect(lsGetJSON('elab_quiz_v1', null)).toEqual({ a: 1 });
});

it('없거나 깨진 값이면 기본값', () => {
  expect(lsGetJSON('none', 7)).toBe(7);
  localStorage.setItem('bad', '{oops');
  expect(lsGetJSON('bad', 7)).toBe(7);
});

it('저장소 접근이 막혀도 예외를 던지지 않는다', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(() => lsSetRaw('x', 'y')).not.toThrow();
  spy.mockRestore();
});
