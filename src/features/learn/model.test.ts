import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getSetting, putSetting, resetDbForTests } from '../../storage/idb';
import {
  extractVideoId, fetchTitle, fmt, groupByFolder, learnVocab, loadFolders, resumeList, saveFolders, sortVideos,
  type Video, type VocabItem,
} from './model';

const vid = (o: Partial<Video>): Video => ({ id: 'v', youtubeId: 'abcdef', title: 't', folderId: null, lines: [], createdAt: 0, lastStudiedAt: 0, ...o });
const voc = (o: Partial<VocabItem>): VocabItem => ({ id: 'w', term: 'x', note: '', type: 'word', createdAt: 0, ...o });

beforeEach(resetDbForTests);
afterEach(() => vi.unstubAllGlobals());

it('extractVideoId: 여러 주소 형식과 ID만 넣은 경우', () => {
  expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s')).toBe('dQw4w9WgXcQ');
  expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(extractVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(extractVideoId('  dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ');
  expect(extractVideoId('abc')).toBeNull();
  expect(extractVideoId('https://example.com/watch')).toBeNull();
});

it('fmt: m:ss, 1시간 넘으면 h:mm:ss, 음수는 0', () => {
  expect([fmt(5), fmt(65.9), fmt(3725), fmt(-3)]).toEqual(['0:05', '1:05', '1:02:05', '0:00']);
});

it('sortVideos: 최근 학습(없으면 만든 시각) 순', () => {
  const vs = [vid({ id: 'a', createdAt: 5, lastStudiedAt: 0 }), vid({ id: 'b', createdAt: 1, lastStudiedAt: 9 }), vid({ id: 'c', createdAt: 7, lastStudiedAt: 0 })];
  expect(sortVideos(vs).map(v => v.id)).toEqual(['b', 'c', 'a']);
});

it('resumeList: 이어보기 위치가 있는 영상만, 최근 순, 최대 8개', () => {
  const vs = Array.from({ length: 10 }, (_, i) => vid({ id: 'r' + i, resume: { time: 30, at: i } }));
  vs.push(vid({ id: 'none' }));
  const list = resumeList(vs);
  expect(list).toHaveLength(8);
  expect(list[0].id).toBe('r9');
  expect(list.some(v => v.id === 'none')).toBe(false);
});

it('groupByFolder: 폴더 순서대로, 없는 폴더를 가리키는 영상은 미분류', () => {
  const folders = [{ id: 'f1', name: '여행' }, { id: 'f2', name: '빈 폴더' }];
  const vs = [vid({ id: 'a', folderId: 'f1' }), vid({ id: 'b', folderId: 'gone' }), vid({ id: 'c' })];
  expect(groupByFolder(vs, folders).map(g => [g.folder?.id ?? null, g.videos.map(v => v.id)])).toEqual([
    ['f1', ['a']], ['f2', []], [null, ['b', 'c']],
  ]);
});

it('learnVocab: 캡처 단어 제외, 최신 순, 종류 필터', () => {
  const list = [voc({ id: 'a', type: 'word', createdAt: 1 }), voc({ id: 'b', type: 'idiom', createdAt: 3 }), voc({ id: 'c', source: 'capture', createdAt: 5 })];
  expect(learnVocab(list, 'all').map(v => v.id)).toEqual(['b', 'a']);
  expect(learnVocab(list, 'idiom').map(v => v.id)).toEqual(['b']);
});

it('fetchTitle: oEmbed 제목, 실패하면 빈 문자열', async () => {
  const f = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ title: '  My Video ' }) }));
  vi.stubGlobal('fetch', f);
  expect(await fetchTitle('dQw4w9WgXcQ')).toBe('My Video');
  expect(f.mock.calls[0][0]).toBe('https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=dQw4w9WgXcQ') + '&format=json');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  expect(await fetchTitle('x')).toBe('');
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
  expect(await fetchTitle('x')).toBe('');
});

it('폴더는 legacy 처럼 settings.folders 에 JSON 문자열로', async () => {
  expect(await loadFolders()).toEqual([]);
  await saveFolders([{ id: 'f1', name: '여행' }]);
  expect(await getSetting('folders')).toEqual({ key: 'folders', value: '[{"id":"f1","name":"여행"}]' });
  expect(await loadFolders()).toEqual([{ id: 'f1', name: '여행' }]);
  await putSetting({ key: 'folders', value: '{oops' });
  expect(await loadFolders()).toEqual([]);
});
