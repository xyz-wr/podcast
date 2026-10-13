import { getSetting, putSetting } from '../storage/idb';

// 이 앱 전용 Supabase 프로젝트. publishable key 는 공개돼도 되는 키이고, 데이터는 RLS 정책으로
// '요청 헤더 x-sync-code 와 같은 동기화 코드의 행'만 열린다 → 동기화 코드가 곧 비밀번호.
export const SB_DEFAULT_URL = 'https://dqinuwadlythebpwpqxc.supabase.co';
export const SB_DEFAULT_KEY = 'sb_publishable_dErSr81L2hcsLRbN8tIcbQ_avmsF-eX';

export interface SyncConfig { url: string; key: string; code: string }
let cfg: SyncConfig = { url: SB_DEFAULT_URL, key: SB_DEFAULT_KEY, code: '' };

export const getSyncConfig = (): SyncConfig => cfg;
export const sbReady = (): boolean => !!(cfg.url && cfg.key && cfg.code);
export const setSyncConfigForTests = (c: SyncConfig): void => { cfg = c; };

export function normSbUrl(s: string): string {
  return (s || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '').replace(/\/+$/, '');
}

async function settingValue(key: 'sbUrl' | 'sbKey' | 'syncCode'): Promise<string> {
  try { return (await getSetting<string>(key))?.value || ''; } catch { return ''; }
}

export async function loadSyncConfig(): Promise<void> {
  cfg = {
    url: (await settingValue('sbUrl')) || SB_DEFAULT_URL,
    key: (await settingValue('sbKey')) || SB_DEFAULT_KEY,
    code: await settingValue('syncCode'),
  };
}

export async function saveSyncConfig(input: SyncConfig): Promise<void> {
  const url = normSbUrl(input.url) || SB_DEFAULT_URL;
  const key = input.key.trim() || SB_DEFAULT_KEY;
  cfg = { url, key, code: input.code.trim() };
  await putSetting({ key: 'sbUrl', value: url === SB_DEFAULT_URL ? '' : url });
  await putSetting({ key: 'sbKey', value: key === SB_DEFAULT_KEY ? '' : key });
  await putSetting({ key: 'syncCode', value: cfg.code });
}

export function genSyncCode(): string {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789', b = new Uint8Array(12);
  crypto.getRandomValues(b);
  let s = '';
  b.forEach((x, i) => { s += a[x % a.length]; if(i === 3 || i === 7) s += '-'; });
  return 'tablo-' + s;
}
