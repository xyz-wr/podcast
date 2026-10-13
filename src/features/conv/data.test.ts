import { expect, it } from 'vitest';
import { CATS, FEMOJI, FOLDERS, TOTAL_CARDS, catFolders, catOf, searchFolders } from './data';

it('11개 카테고리가 46개 주제를 한 번씩 덮고, 모든 주제에 이모지가 있다', () => {
  expect(CATS).toHaveLength(11);
  const ids = CATS.flatMap(c => c.f);
  expect(ids).toHaveLength(46);
  expect(new Set(ids).size).toBe(46);
  expect(FOLDERS.every(f => ids.includes(f.id) && FEMOJI[f.id])).toBe(true);
  expect(TOTAL_CARDS).toBe(321);
});

it('주제 → 카테고리, 카테고리 → 주제', () => {
  expect(catOf('driving-on-the-road').id).toBe('travel');
  expect(catFolders(CATS[0]).map(f => f.id)).toEqual(CATS[0].f);
});

it('검색: 주제 이름, 표현(대소문자 무시), 뜻', () => {
  expect(searchFolders('')).toBe(FOLDERS);
  expect(searchFolders('HIT THE ROAD').map(f => f.id)).toContain('driving-on-the-road');
  expect(searchFolders('운전').map(f => f.id)).toContain('driving-on-the-road');
  expect(searchFolders('출발하다').map(f => f.id)).toContain('driving-on-the-road');
  expect(searchFolders('zzzz-none')).toEqual([]);
});
