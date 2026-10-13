import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { IDB_NAME, IDB_VERSION, KV_KEYS, LS_KEYS, SETTINGS_KEYS, SYNCED_STORES } from './keys';

const LEGACY = fs.readFileSync(path.resolve(process.cwd(), 'legacy/index.html'), 'utf8');

// 실제 사이트를 교체할 때 기존 데이터를 그대로 읽어야 한다. 이 값이 바뀌면 사용자 기록이 사라진다.
it('저장소 이름이 기존 앱과 같다', () => {
  expect(LS_KEYS).toEqual({
    tab: 'elab_tab', voice: 'elab_voice', progress: 'elab_progress_v1',
    quiz: 'elab_quiz_v1', voca: 'elab_voca_v1',
  });
  expect(IDB_NAME).toBe('tabloEnglishLab');
  expect(IDB_VERSION).toBe(1);
  expect(SETTINGS_KEYS).toEqual(['activity', 'folders', 'geminiKey', 'sbKey', 'sbUrl', 'syncCode', 'syncQueue']);
  expect(KV_KEYS).toEqual({ geminiKey: 'geminiKey', voca: 'voca_v1' });
  expect(SYNCED_STORES).toEqual(['vocab', 'videos']);
});

it('모든 이름이 legacy/index.html 에 실제로 있다', () => {
  for(const v of [...Object.values(LS_KEYS), IDB_NAME, ...SETTINGS_KEYS, ...Object.values(KV_KEYS)])
    expect(LEGACY, v).toContain(`'${v}'`);
  expect(LEGACY).toContain(`DB_VER=${IDB_VERSION}`);
  expect(LEGACY).toContain(`SYNCED_STORES=['${SYNCED_STORES.join("','")}']`);
});
