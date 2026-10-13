import { beforeEach, expect, it } from 'vitest';
import { getSetting, putSetting, resetDbForTests } from '../storage/idb';
import { SB_DEFAULT_KEY, SB_DEFAULT_URL, genSyncCode, getSyncConfig, loadSyncConfig, normSbUrl, saveSyncConfig, sbReady, setSyncConfigForTests } from './config';

beforeEach(async () => {
  await resetDbForTests();
  setSyncConfigForTests({ url: SB_DEFAULT_URL, key: SB_DEFAULT_KEY, code: '' });
});

it('저장된 값이 없으면 기본 서버, 동기화 코드 없음 → 꺼짐', async () => {
  await loadSyncConfig();
  expect(getSyncConfig()).toEqual({ url: SB_DEFAULT_URL, key: SB_DEFAULT_KEY, code: '' });
  expect(sbReady()).toBe(false);
});

it('기존 앱이 저장한 settings 값을 읽는다', async () => {
  await putSetting({ key: 'sbUrl', value: 'https://mine.supabase.co' });
  await putSetting({ key: 'sbKey', value: 'k1' });
  await putSetting({ key: 'syncCode', value: 'tablo-aaaa-bbbb-cccc' });
  await loadSyncConfig();
  expect(getSyncConfig()).toEqual({ url: 'https://mine.supabase.co', key: 'k1', code: 'tablo-aaaa-bbbb-cccc' });
  expect(sbReady()).toBe(true);
});

it('기본 서버 값은 빈 문자열로 저장한다 (기존 앱과 동일)', async () => {
  await saveSyncConfig({ url: '', key: '', code: ' tablo-x ' });
  expect((await getSetting('sbUrl'))?.value).toBe('');
  expect((await getSetting('sbKey'))?.value).toBe('');
  expect((await getSetting('syncCode'))?.value).toBe('tablo-x');
  expect(getSyncConfig().url).toBe(SB_DEFAULT_URL);
});

it('URL 정규화', () => {
  expect(normSbUrl(' https://a.supabase.co/rest/v1/ ')).toBe('https://a.supabase.co');
});

it('동기화 코드 형식', () => {
  expect(genSyncCode()).toMatch(/^tablo-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
});
