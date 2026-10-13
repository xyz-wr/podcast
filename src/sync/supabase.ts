import { getSyncConfig, sbReady } from './config';

export interface SyncRow<T = unknown> { sync_code: string; id: string; data: T | null; deleted: boolean; updated_at: number }
export interface KvRow { sync_code: string; k: string; v: string; updated_at: number }

function headers(): Record<string, string> {
  const c = getSyncConfig();
  return { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json', 'x-sync-code': c.code };
}
const mine = () => 'sync_code=eq.' + encodeURIComponent(getSyncConfig().code) + '&select=*';

async function upsert(path: string, body: unknown, label: string): Promise<void> {
  const r = await fetch(`${getSyncConfig().url}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(body),
  });
  if(!r.ok) throw new Error(`${label} ${r.status}`);
}

export async function sbUpsert(table: string, rows: SyncRow[]): Promise<void> {
  if(!sbReady() || !rows.length) return;
  await upsert(`${table}?on_conflict=sync_code,id`, rows, `sbUpsert ${table}`);
}

export async function sbSelect<T = unknown>(table: string): Promise<SyncRow<T>[]> {
  if(!sbReady()) return [];
  const r = await fetch(`${getSyncConfig().url}/rest/v1/${table}?${mine()}`, { headers: headers() });
  if(!r.ok) throw new Error(`sbSelect ${table} ${r.status}`);
  return r.json();
}

export async function kvUpsert(k: string, v: string, ts: number): Promise<void> {
  if(!sbReady()) return;
  await upsert('kv?on_conflict=sync_code,k', [{ sync_code: getSyncConfig().code, k, v, updated_at: ts }], 'kvUpsert');
}

export async function kvSelect(): Promise<KvRow[]> {
  if(!sbReady()) return [];
  const r = await fetch(`${getSyncConfig().url}/rest/v1/kv?${mine()}`, { headers: headers() });
  if(!r.ok) throw new Error(`kvSelect ${r.status}`);
  return r.json();
}
