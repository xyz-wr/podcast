// 사생활 보호 모드 등에서 localStorage 접근이 막혀도 앱이 멈추지 않게 감싼다.
export function lsGetRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function lsSetRaw(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* 저장 실패는 무시 (기존 앱과 동일) */ }
}
export function lsGetJSON<T>(key: string, fallback: T): T {
  const raw = lsGetRaw(key);
  if(raw == null) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
export function lsSetJSON(key: string, value: unknown): void {
  lsSetRaw(key, JSON.stringify(value));
}
