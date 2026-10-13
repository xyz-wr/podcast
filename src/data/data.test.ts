import { expect, it } from 'vitest';
import conv from './conv.json';
import * as Q from '../core/legacy/quiz-core.js';
import * as V from '../core/legacy/voca-core.js';

it('회화 데이터에 폴더와 카드가 있다', () => {
  expect(conv.folders.length).toBeGreaterThan(0);
  expect(conv.folders[0].cards.length).toBeGreaterThan(0);
});

it('추출한 로직 모듈이 함수를 내보낸다', () => {
  expect(typeof Q.qGrade).toBe('function');
  expect(typeof V.vkMergeState).toBe('function');
});
