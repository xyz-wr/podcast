import { idbAll, idbDelRaw, idbGet, idbPutRaw } from '../storage/idb';
import { SYNCED_STORES } from '../storage/keys';
import { getSyncConfig, sbReady } from './config';
import { flushQueue, setApplying } from './queue';
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

export async function syncPull(): Promise<void> {
  if(!sbReady()) return;
  setApplying(true);
  try {
    for(const table of SYNCED_STORES){
      let rows: SyncRow<Stamped>[];
      try { rows = await sbSelect<Stamped>(table); } catch(e){ console.warn('syncPull ' + table, (e as Error).message); continue; }
      for(const row of rows){
        const local = await idbGet<Stamped>(table, row.id);
        const action = syncResolve(local ? (local.updatedAt || 0) : -1, row);
        if(action === 'put') await idbPutRaw(table, row.data);
        else if(action === 'delete' && local) await idbDelRaw(table, row.id);
      }
    }
  } finally { setApplying(false); }
}

export async function pushAll(): Promise<void> {
  if(!sbReady()) return;
  for(const table of SYNCED_STORES){
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
    await syncPull();
    if(full) await pushAll();
    for(const h of hooks) await h();
  } catch(e){ console.warn('autoSync', (e as Error).message); }
  finally { syncing = false; }
}
