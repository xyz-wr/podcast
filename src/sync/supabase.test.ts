import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setSyncConfigForTests } from './config';
import { kvSelect, kvUpsert, sbSelect, sbUpsert } from './supabase';

const CFG = { url: 'https://x.supabase.co', key: 'K', code: 'tablo-a b' };
function mockFetch(body: unknown = [], status = 200) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: status < 400, status, json: async () => body }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => setSyncConfigForTests(CFG));
afterEach(() => vi.unstubAllGlobals());

it('upsert: 기존 앱과 같은 URL·헤더·본문', async () => {
  const f = mockFetch();
  const rows = [{ sync_code: CFG.code, id: 'w1', data: { id: 'w1' }, deleted: false, updated_at: 1 }];
  await sbUpsert('vocab', rows);
  const [url, init] = f.mock.calls[0];
  expect(url).toBe('https://x.supabase.co/rest/v1/vocab?on_conflict=sync_code,id');
  expect(init?.method).toBe('POST');
  expect(init?.headers).toEqual({
    apikey: 'K', Authorization: 'Bearer K', 'Content-Type': 'application/json',
    'x-sync-code': CFG.code, Prefer: 'resolution=merge-duplicates',
  });
  expect(JSON.parse(init?.body as string)).toEqual(rows);
});

it('select: 내 동기화 코드의 행만 요청', async () => {
  const f = mockFetch([{ id: 'w1' }]);
  expect(await sbSelect('videos')).toEqual([{ id: 'w1' }]);
  expect(f.mock.calls[0][0]).toBe('https://x.supabase.co/rest/v1/videos?sync_code=eq.tablo-a%20b&select=*');
});

it('kv upsert / select', async () => {
  const f = mockFetch([{ k: 'voca_v1', v: '{}' }]);
  await kvUpsert('voca_v1', '{}', 9);
  expect(f.mock.calls[0][0]).toBe('https://x.supabase.co/rest/v1/kv?on_conflict=sync_code,k');
  expect(JSON.parse(f.mock.calls[0][1]?.body as string)).toEqual([{ sync_code: CFG.code, k: 'voca_v1', v: '{}', updated_at: 9 }]);
  expect(await kvSelect()).toEqual([{ k: 'voca_v1', v: '{}' }]);
  expect(f.mock.calls[1][0]).toBe('https://x.supabase.co/rest/v1/kv?sync_code=eq.tablo-a%20b&select=*');
});

it('실패 응답이면 예외', async () => {
  mockFetch([], 401);
  await expect(sbSelect('vocab')).rejects.toThrow('sbSelect vocab 401');
});

it('동기화 코드가 없으면 요청하지 않는다', async () => {
  setSyncConfigForTests({ ...CFG, code: '' });
  const f = mockFetch();
  await sbUpsert('vocab', [{ sync_code: '', id: 'a', data: null, deleted: true, updated_at: 1 }]);
  expect(await sbSelect('vocab')).toEqual([]);
  expect(f).not.toHaveBeenCalled();
});
