import { getSetting, putSetting } from '../storage/idb';
import { sbReady } from './config';
import { sbUpsert, type SyncRow } from './supabase';

export interface QueueItem { table: string; row: SyncRow }

let queue: QueueItem[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let applying = false;   // 서버에서 받아 반영하는 중에는 다시 올리지 않는다

export const getQueue = (): QueueItem[] => queue;
export const setApplying = (v: boolean): void => { applying = v; };

function persist(): Promise<void> {
  return putSetting({ key: 'syncQueue', value: queue }).catch(() => {});   // 오프라인 대비 영속
}

export function queuePush(table: string, row: SyncRow): void {
  if(applying || !sbReady()) return;
  queue = queue.filter(q => !(q.table === table && q.row.id === row.id));   // 같은 항목은 최신만
  queue.push({ table, row });
  void persist();
  clearTimeout(timer);
  timer = setTimeout(() => void flushQueue(), 800);
}

export async function flushQueue(): Promise<void> {
  if(!sbReady() || !queue.length) return;
  const batch = queue;
  queue = [];
  const byTable = new Map<string, Map<string, SyncRow>>();   // id별 최신 1건 (중복 키는 Supabase가 배치를 거부)
  for(const { table, row } of batch){
    if(!byTable.has(table)) byTable.set(table, new Map());
    byTable.get(table)!.set(row.id, row);
  }
  try {
    for(const [table, rows] of byTable) await sbUpsert(table, [...rows.values()]);
    await persist();
  } catch(e){
    queue = batch.concat(queue);   // 실패분 복원
    await persist();
    console.warn('flushQueue retry later:', (e as Error).message);
  }
}

export async function restoreQueue(): Promise<void> {
  try { queue = (await getSetting<QueueItem[]>('syncQueue'))?.value ?? []; } catch { queue = []; }
}

export function resetQueueForTests(): void {
  queue = []; clearTimeout(timer); applying = false;
}
