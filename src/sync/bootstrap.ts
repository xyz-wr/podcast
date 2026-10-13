import { loadSyncConfig } from './config';
import { autoSync } from './engine';
import { flushQueue, restoreQueue } from './queue';

// legacy init() 의 동기화 부분과 같다. 동기화 코드가 없으면 아무 요청도 하지 않는다.
export async function startSync(): Promise<void> {
  try { await navigator.storage?.persist?.(); } catch { /* 지원 안 함 */ }
  await restoreQueue();   // sbReady 전에는 queuePush 가 무시되므로 저장된 큐를 덮어쓸 일이 없다
  await loadSyncConfig();
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') void autoSync(false); });
  window.addEventListener('focus', () => void autoSync(false));
  window.addEventListener('online', () => void flushQueue());
  await autoSync(true);   // 리스너를 먼저 붙인다 (autoSync 가 재진입/코드 없음을 막아 준다)
}
