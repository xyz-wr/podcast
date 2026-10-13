import { idbDelRaw, idbPutRaw, type StoreName } from '../storage/idb';
import { SYNCED_STORES } from '../storage/keys';
import { getSyncConfig } from './config';
import { queuePush } from './queue';

const isSynced = (s: StoreName): boolean => (SYNCED_STORES as readonly string[]).includes(s);
type Stamped = { id: string; updatedAt: number };

/** legacy idbPut 과 같다: 동기화 대상(vocab, videos)이면 updatedAt 을 찍고 푸시 큐에 넣는다. */
export async function idbPut<T extends object>(s: StoreName, v: T): Promise<T & { updatedAt?: number }> {
  if(!isSynced(s)){ await idbPutRaw(s, v); return v; }
  const row = v as T & Stamped;
  row.updatedAt = Date.now();
  await idbPutRaw(s, row);
  queuePush(s, { sync_code: getSyncConfig().code, id: row.id, data: row, deleted: false, updated_at: row.updatedAt });
  return row;
}

/** 동기화 대상이면 삭제 표시(tombstone)를 올린다. */
export async function idbDel(s: StoreName, id: string): Promise<void> {
  await idbDelRaw(s, id);
  if(isSynced(s)) queuePush(s, { sync_code: getSyncConfig().code, id, data: null, deleted: true, updated_at: Date.now() });
}
