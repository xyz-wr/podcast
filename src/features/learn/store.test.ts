import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const ui = vi.hoisted(() => ({ confirm: true, text: '' as string | null, toasts: [] as string[] }));
vi.mock('../../ui/store', () => ({
  askConfirm: vi.fn(async () => ui.confirm),
  askText: vi.fn(async () => ui.text),
  toast: (m: string) => { ui.toasts.push(m); },
}));

import { getSetting, idbAll, idbGet, idbPutRaw, resetDbForTests } from '../../storage/idb';
import type { Video, VocabItem } from './model';
import { initialLearnState, useLearnStore } from './store';

const st = () => useLearnStore.getState();
const vid = (o: Partial<Video>): Video => ({ id: 'v', youtubeId: 'abcdef', title: 't', folderId: null, lines: [], createdAt: 1, lastStudiedAt: 1, ...o });

beforeEach(async () => {
  await resetDbForTests();
  ui.confirm = true; ui.text = ''; ui.toasts = [];
  useLearnStore.setState(initialLearnState());
});
afterEach(() => vi.unstubAllGlobals());

it('loadAll: legacy 기록(폴더는 JSON 문자열)을 읽고 최근 학습 순으로', async () => {
  await idbPutRaw('videos', vid({ id: 'a', lastStudiedAt: 1 }));
  await idbPutRaw('videos', vid({ id: 'b', lastStudiedAt: 9 }));
  await idbPutRaw('vocab', { id: 'w1', videoId: 'a', term: 'hit', note: '', type: 'word', createdAt: 1 });
  await idbPutRaw('settings', { key: 'folders', value: '[{"id":"f1","name":"여행"}]' });
  await st().loadAll();
  expect(st().videos.map(v => v.id)).toEqual(['b', 'a']);
  expect(st().vocab).toHaveLength(1);
  expect(st().folders).toEqual([{ id: 'f1', name: '여행' }]);
  expect(st().loaded).toBe(true);
});

it('addVideo: 잘못된 주소면 알림만, 맞으면 제목을 가져와 legacy 형식으로 저장하고 학습 화면으로', async () => {
  expect(await st().addVideo('not a url')).toBe(false);
  expect(ui.toasts).toContain('YouTube 주소/ID를 확인해주세요');
  expect(await idbAll('videos')).toEqual([]);

  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ title: 'My Video' }) })));
  expect(await st().addVideo('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  const [v] = await idbAll<Video>('videos');
  expect(v).toMatchObject({ youtubeId: 'dQw4w9WgXcQ', title: 'My Video', folderId: null, lines: [] });
  expect(Object.keys(v).sort()).toEqual(['createdAt', 'folderId', 'id', 'lastStudiedAt', 'lines', 'title', 'updatedAt', 'youtubeId']);
  expect(st().screen).toEqual({ name: 'study', id: v.id });
  expect(st().addOpen).toBe(false);
});

it('addVideo: 제목을 못 가져오면 "새 영상"', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  await st().addVideo('dQw4w9WgXcQ');
  expect((await idbAll<Video>('videos'))[0].title).toBe('새 영상');
});

it('폴더 만들기·이름 바꾸기·삭제(안의 영상은 미분류로)', async () => {
  ui.text = '여행';
  const fid = await st().createFolder();
  expect(fid).toBeTruthy();
  expect(JSON.parse((await getSetting<string>('folders'))!.value)).toEqual([{ id: fid, name: '여행' }]);
  ui.text = '해외 여행';
  await st().renameFolder(fid!);
  expect(st().folders[0].name).toBe('해외 여행');

  await idbPutRaw('videos', vid({ id: 'a', folderId: fid }));
  await st().loadAll();
  await st().deleteFolder(fid!);
  expect(st().folders).toEqual([]);
  expect((await idbGet<Video>('videos', 'a'))!.folderId).toBeNull();
});

it('이름 입력을 취소하면 폴더를 만들지 않는다', async () => {
  ui.text = null;
  expect(await st().createFolder()).toBeNull();
  expect(st().folders).toEqual([]);
});

it('영상 이동: 원래 폴더가 비면 자동 삭제, 다른 영상이 남아 있으면 유지', async () => {
  await idbPutRaw('settings', { key: 'folders', value: '[{"id":"f1","name":"A"},{"id":"f2","name":"B"}]' });
  await idbPutRaw('videos', vid({ id: 'a', folderId: 'f1' }));
  await idbPutRaw('videos', vid({ id: 'b', folderId: 'f1' }));
  await st().loadAll();
  st().openFolderPicker('a');
  await st().moveToFolder('f2');
  expect(st().folders.map(f => f.id)).toEqual(['f1', 'f2']);
  st().openFolderPicker('b');
  await st().moveToFolder(null);
  expect(st().folders.map(f => f.id)).toEqual(['f2']);
  expect((await idbGet<Video>('videos', 'b'))!.folderId).toBeNull();
  expect(st().movingVideoId).toBeNull();
  expect(ui.toasts).toContain('이동했어요');
});

it('영상 삭제: 확인 후 그 영상의 단어·녹음까지 지우고 빈 폴더 정리', async () => {
  await idbPutRaw('settings', { key: 'folders', value: '[{"id":"f1","name":"A"}]' });
  await idbPutRaw('videos', vid({ id: 'a', folderId: 'f1' }));
  await idbPutRaw('vocab', { id: 'w1', videoId: 'a', term: 'x', note: '', type: 'word', createdAt: 1 });
  await idbPutRaw('vocab', { id: 'w2', videoId: 'other', term: 'y', note: '', type: 'word', createdAt: 1 });
  await idbPutRaw('recordings', { id: 'r1', videoId: 'a' });
  await st().loadAll();

  ui.confirm = false;
  await st().deleteVideo('a');
  expect(await idbGet('videos', 'a')).toBeDefined();

  ui.confirm = true;
  await st().deleteVideo('a');
  expect(await idbGet('videos', 'a')).toBeUndefined();
  expect((await idbAll<VocabItem>('vocab')).map(v => v.id)).toEqual(['w2']);
  expect(await idbAll('recordings')).toEqual([]);
  expect(st().folders).toEqual([]);
  expect(ui.toasts).toContain('영상을 삭제했어요');
});

it('이어보기에서 빼기, 영상 열기(최근 학습 시각 갱신), 제목 바꾸기, 목록으로', async () => {
  await idbPutRaw('videos', vid({ id: 'a', resume: { time: 42, at: 5 }, lastStudiedAt: 1 }));
  await st().loadAll();
  await st().removeResume('a');
  expect((await idbGet<Video>('videos', 'a'))!.resume).toBeUndefined();

  await st().openVideo('a');
  expect(st().screen).toEqual({ name: 'study', id: 'a' });
  expect(st().current!.lastStudiedAt).toBeGreaterThan(1);
  ui.text = '새 제목';
  await st().renameVideo();
  expect((await idbGet<Video>('videos', 'a'))!.title).toBe('새 제목');
  await st().backToLibrary();
  expect(st().screen).toEqual({ name: 'library' });
  expect(st().videos[0].title).toBe('새 제목');
});

it('단어 삭제는 확인 후에만', async () => {
  await idbPutRaw('vocab', { id: 'w1', term: 'hit', note: '', type: 'word', createdAt: 1 });
  await st().loadAll();
  ui.confirm = false;
  await st().delVocab('w1');
  expect(st().vocab).toHaveLength(1);
  ui.confirm = true;
  await st().delVocab('w1');
  expect(st().vocab).toEqual([]);
  expect(await idbGet('vocab', 'w1')).toBeUndefined();
});
