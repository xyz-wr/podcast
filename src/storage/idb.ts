import { IDB_NAME, IDB_VERSION, type SettingsKey } from './keys';

export type StoreName = 'videos' | 'vocab' | 'recordings' | 'settings';
export interface SettingRow<V = unknown> { key: SettingsKey; value: V; updatedAt?: number }

let dbPromise: Promise<IDBDatabase> | null = null;

// legacy 의 db() 와 같은 구조. 저장소를 추가해야 하면 IDB_VERSION 을 올리고 기존 저장소는 건드리지 않는다.
export function openDb(): Promise<IDBDatabase> {
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, IDB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if(!d.objectStoreNames.contains('videos')) d.createObjectStore('videos', { keyPath: 'id' });
      if(!d.objectStoreNames.contains('vocab')) d.createObjectStore('vocab', { keyPath: 'id' }).createIndex('videoId', 'videoId');
      if(!d.objectStoreNames.contains('recordings')) d.createObjectStore('recordings', { keyPath: 'id' }).createIndex('videoId', 'videoId');
      if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => { dbPromise = null; reject(r.error); };
  });
  return dbPromise;
}

function req<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(d => new Promise<T>((resolve, reject) => {
    const r = fn(d.transaction(store, mode).objectStore(store));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  }));
}

export const idbGet = <T = unknown>(s: StoreName, k: IDBValidKey) => req<T | undefined>(s, 'readonly', o => o.get(k));
export const idbAll = <T = unknown>(s: StoreName) => req<T[]>(s, 'readonly', o => o.getAll());
export const idbByIndex = <T = unknown>(s: StoreName, index: string, v: IDBValidKey) =>
  req<T[]>(s, 'readonly', o => o.index(index).getAll(v));
/** 동기화 훅 없이 저장. 동기화 대상(vocab, videos)은 src/sync/repo.ts 의 idbPut 을 쓴다. */
export const idbPutRaw = (s: StoreName, v: unknown) => req<IDBValidKey>(s, 'readwrite', o => o.put(v));
export const idbDelRaw = (s: StoreName, k: IDBValidKey) => req<undefined>(s, 'readwrite', o => o.delete(k));

export const getSetting = <V = unknown>(key: SettingsKey) => idbGet<SettingRow<V>>('settings', key);
export const putSetting = <V>(row: SettingRow<V>) => idbPutRaw('settings', row).then(() => undefined);

export async function resetDbForTests(): Promise<void> {
  if(dbPromise){ (await dbPromise).close(); dbPromise = null; }
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(IDB_NAME);
    r.onsuccess = () => resolve();
    r.onblocked = () => resolve();
    r.onerror = () => reject(r.error);
  });
}
