import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getSetting, idbGet, idbPutRaw, resetDbForTests } from '../storage/idb';
import { setSyncConfigForTests } from './config';
import { autoSync, pushAll, registerSyncHook, syncPull } from './engine';
import { flushQueue, getQueue, queuePush, resetQueueForTests, restoreQueue } from './queue';
import { idbDel, idbPut } from './repo';

const CFG = { url: 'https://x.supabase.co', key: 'K', code: 'tablo-test' };
type Call = { url: string; method: string; body: unknown };
let calls: Call[];
let tables: Record<string, unknown[]>;
let failPosts = false;

beforeEach(async () => {
  await resetDbForTests();
  resetQueueForTests();
  setSyncConfigForTests(CFG);
  calls = []; tables = { vocab: [], videos: [], kv: [] }; failPosts = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, method, body });
    const table = url.split('/rest/v1/')[1].split('?')[0];
    if(method === 'POST' && failPosts) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => (method === 'GET' ? tables[table] : []) };
  }));
});
afterEach(() => { vi.unstubAllGlobals(); resetQueueForTests(); });

it('queuePush: 같은 항목은 최신 1건만 남기고 settings.syncQueue 에 보관', async () => {
  queuePush('vocab', { sync_code: CFG.code, id: 'a', data: { v: 1 }, deleted: false, updated_at: 1 });
  queuePush('vocab', { sync_code: CFG.code, id: 'a', data: { v: 2 }, deleted: false, updated_at: 2 });
  expect(getQueue()).toHaveLength(1);
  expect(getQueue()[0].row.data).toEqual({ v: 2 });
  await vi.waitFor(async () => expect((await getSetting<unknown[]>('syncQueue'))?.value).toHaveLength(1));
});

it('flushQueue: 성공하면 비우고, 실패하면 되돌려 보관', async () => {
  queuePush('videos', { sync_code: CFG.code, id: 'v1', data: { id: 'v1' }, deleted: false, updated_at: 1 });
  failPosts = true;
  await flushQueue();
  expect(getQueue()).toHaveLength(1);
  failPosts = false;
  await flushQueue();
  expect(getQueue()).toHaveLength(0);
  expect(calls.filter(c => c.method === 'POST').at(-1)?.url).toBe('https://x.supabase.co/rest/v1/videos?on_conflict=sync_code,id');
  expect((await getSetting<unknown[]>('syncQueue'))?.value).toEqual([]);
});

it('restoreQueue: 보관된 큐를 다시 읽는다', async () => {
  const item = { table: 'vocab', row: { sync_code: CFG.code, id: 'z', data: null, deleted: true, updated_at: 3 } };
  await idbPutRaw('settings', { key: 'syncQueue', value: [item] });
  await restoreQueue();
  expect(getQueue()).toEqual([item]);
});

it('idbPut: 동기화 대상은 updatedAt 을 찍고 큐에 넣는다, settings 는 넣지 않는다', async () => {
  const v = await idbPut('vocab', { id: 'w1', word: 'x' });
  expect(v.updatedAt).toEqual(expect.any(Number));
  expect(getQueue()).toEqual([{ table: 'vocab', row: { sync_code: CFG.code, id: 'w1', data: v, deleted: false, updated_at: v.updatedAt } }]);
  await idbPut('settings', { key: 'activity', value: '{}' });
  expect(getQueue()).toHaveLength(1);
  await idbDel('vocab', 'w1');
  expect(getQueue()[0].row).toMatchObject({ id: 'w1', deleted: true, data: null });
  expect(await idbGet('vocab', 'w1')).toBeUndefined();
});

it('syncPull: 서버가 더 새로우면 반영, 오래되면 무시, 삭제 표시는 지운다 (큐에는 넣지 않음)', async () => {
  await idbPutRaw('vocab', { id: 'old', updatedAt: 10 });
  await idbPutRaw('vocab', { id: 'mine', updatedAt: 99 });
  await idbPutRaw('vocab', { id: 'gone', updatedAt: 10 });
  tables.vocab = [
    { sync_code: CFG.code, id: 'old', data: { id: 'old', updatedAt: 20, w: 'new' }, deleted: false, updated_at: 20 },
    { sync_code: CFG.code, id: 'mine', data: { id: 'mine', updatedAt: 50 }, deleted: false, updated_at: 50 },
    { sync_code: CFG.code, id: 'gone', data: null, deleted: true, updated_at: 30 },
    { sync_code: CFG.code, id: 'fresh', data: { id: 'fresh', updatedAt: 5 }, deleted: false, updated_at: 5 },
  ];
  await syncPull();
  expect(await idbGet('vocab', 'old')).toEqual({ id: 'old', updatedAt: 20, w: 'new' });
  expect(await idbGet('vocab', 'mine')).toEqual({ id: 'mine', updatedAt: 99 });
  expect(await idbGet('vocab', 'gone')).toBeUndefined();
  expect(await idbGet('vocab', 'fresh')).toEqual({ id: 'fresh', updatedAt: 5 });
  expect(getQueue()).toHaveLength(0);
});

it('pushAll: updatedAt 이 없으면 찍어서 전부 올린다', async () => {
  await idbPutRaw('videos', { id: 'v1' });
  await pushAll();
  const post = calls.find(c => c.method === 'POST' && c.url.includes('/videos?'))!;
  expect(post.body).toEqual([{ sync_code: CFG.code, id: 'v1', data: { id: 'v1', updatedAt: expect.any(Number) }, deleted: false, updated_at: expect.any(Number) }]);
  expect((await idbGet<{ updatedAt?: number }>('videos', 'v1'))?.updatedAt).toEqual(expect.any(Number));
});

it('autoSync: 등록한 후속 처리를 실행하고, 동기화 코드가 없으면 아무것도 안 한다', async () => {
  const hook = vi.fn(async () => {});
  const off = registerSyncHook(hook);
  await autoSync(true);
  expect(hook).toHaveBeenCalledTimes(1);
  setSyncConfigForTests({ ...CFG, code: '' });
  calls = [];
  await autoSync(true);
  expect(calls).toEqual([]);
  expect(hook).toHaveBeenCalledTimes(1);
  off();
});
