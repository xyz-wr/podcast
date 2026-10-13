import { beforeEach, expect, it } from 'vitest';
import { getSetting, idbAll, idbByIndex, idbDelRaw, idbGet, idbPutRaw, openDb, putSetting, resetDbForTests } from './idb';

// legacy/index.html 의 db() 와 똑같은 방식으로 만든 DB
function openLikeLegacy(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('tabloEnglishLab', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('videos', { keyPath: 'id' });
      d.createObjectStore('vocab', { keyPath: 'id' }).createIndex('videoId', 'videoId');
      d.createObjectStore('recordings', { keyPath: 'id' }).createIndex('videoId', 'videoId');
      d.createObjectStore('settings', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

beforeEach(resetDbForTests);

it('기존 앱이 저장한 데이터를 그대로 읽는다', async () => {
  const legacy = await openLikeLegacy();
  await new Promise<void>((resolve, reject) => {
    const t = legacy.transaction(['vocab', 'settings'], 'readwrite');
    t.objectStore('vocab').put({ id: 'w1', videoId: 'v1', word: 'hit the road', updatedAt: 5 });
    t.objectStore('settings').put({ key: 'syncCode', value: 'tablo-abcd-efgh-jkmn' });
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  legacy.close();

  expect(await idbGet('vocab', 'w1')).toEqual({ id: 'w1', videoId: 'v1', word: 'hit the road', updatedAt: 5 });
  expect(await idbByIndex('vocab', 'videoId', 'v1')).toHaveLength(1);
  expect(await getSetting('syncCode')).toEqual({ key: 'syncCode', value: 'tablo-abcd-efgh-jkmn' });
});

it('빈 브라우저에서는 기존과 같은 구조로 만든다', async () => {
  const d = await openDb();
  expect([...d.objectStoreNames].sort()).toEqual(['recordings', 'settings', 'videos', 'vocab']);
  const t = d.transaction(['videos', 'vocab', 'recordings', 'settings']);
  expect(t.objectStore('videos').keyPath).toBe('id');
  expect(t.objectStore('vocab').keyPath).toBe('id');
  expect([...t.objectStore('vocab').indexNames]).toEqual(['videoId']);
  expect([...t.objectStore('recordings').indexNames]).toEqual(['videoId']);
  expect(t.objectStore('settings').keyPath).toBe('key');
});

it('put / all / delete', async () => {
  await idbPutRaw('videos', { id: 'a' });
  await idbPutRaw('videos', { id: 'b' });
  expect(await idbAll('videos')).toHaveLength(2);
  await idbDelRaw('videos', 'a');
  expect(await idbAll('videos')).toEqual([{ id: 'b' }]);
  await putSetting({ key: 'activity', value: '{}' });
  expect((await getSetting<string>('activity'))?.value).toBe('{}');
});
