import { idbAll, idbDelRaw, idbGet, idbPutRaw } from '../storage/idb';
import { SYNCED_STORES, type SyncedStore } from '../storage/keys';
import { getSyncConfig, sbReady } from './config';
import { flushQueue } from './queue';
import { syncResolve } from './resolve';
import { sbSelect, sbUpsert, type SyncRow } from './supabase';

type Stamped = { id: string; updatedAt?: number };
export type SyncHook = () => Promise<void>;

// 기능별 후속 처리(Gemini 키 kv, 보카 kv 병합, 화면 다시 읽기)는 각 Phase에서 여기에 등록한다.
const hooks: SyncHook[] = [];
export function registerSyncHook(h: SyncHook): () => void {
  hooks.push(h);
  return () => { const i = hooks.indexOf(h); if(i >= 0) hooks.splice(i, 1); };
}

/** 받기에 성공한 테이블 목록을 돌려준다 (실패한 테이블은 pushAll 에서 건너뛰기 위함). */
export async function syncPull(): Promise<SyncedStore[]> {
  const pulled: SyncedStore[] = [];
  if(!sbReady()) return pulled;
  for(const table of SYNCED_STORES){
    let rows: SyncRow<Stamped>[];
    try { rows = await sbSelect<Stamped>(table); } catch(e){ console.warn('syncPull ' + table, (e as Error).message); continue; }
    for(const row of rows){
      const local = await idbGet<Stamped>(table, row.id);
      const action = syncResolve(local ? (local.updatedAt || 0) : -1, row);
      if(action === 'put') await idbPutRaw(table, row.data);
      else if(action === 'delete' && local) await idbDelRaw(table, row.id);
    }
    pulled.push(table);
  }
  return pulled;
}

export async function pushAll(tables: readonly SyncedStore[] = SYNCED_STORES): Promise<void> {
  if(!sbReady()) return;
  for(const table of tables){
    const rows: SyncRow[] = [];
    for(const v of await idbAll<Stamped>(table)){
      if(!v.updatedAt){ v.updatedAt = Date.now(); await idbPutRaw(table, v); }
      rows.push({ sync_code: getSyncConfig().code, id: v.id, data: v, deleted: false, updated_at: v.updatedAt });
    }
    if(rows.length) await sbUpsert(table, rows);
  }
}

let syncing = false;
/** 버튼 없이 자동 동기화 (앱 열 때 full=true, 돌아올 때 false). */
export async function autoSync(full: boolean): Promise<void> {
  if(!sbReady() || syncing) return;
  syncing = true;
  try {
    await flushQueue();
    const pulled = await syncPull();
    if(full) await pushAll(pulled);
    for(const h of hooks) await h();
  } catch(e){ console.warn('autoSync', (e as Error).message); }
  finally { syncing = false; }
}
