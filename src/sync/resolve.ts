export interface RemoteStamp { updated_at: number; deleted: boolean }
export type SyncAction = 'put' | 'delete' | 'skip';

/** 항목 단위 last-write-wins. 로컬에 없으면 localUpdatedAt = -1. */
export function syncResolve(localUpdatedAt: number, remote: RemoteStamp): SyncAction {
  if(!(remote.updated_at > localUpdatedAt)) return 'skip';
  return remote.deleted ? 'delete' : 'put';
}
