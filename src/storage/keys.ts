// 기존 앱(legacy/index.html)과 같은 저장소를 읽어야 한다. 이름을 바꾸면 사용자 기록이 사라진다.
export const LS_KEYS = {
  tab: 'elab_tab',               // 마지막 탭 (JSON 아님, 문자열 그대로)
  voice: 'elab_voice',           // TTS 음성
  progress: 'elab_progress_v1',  // 회화 진도
  diary: 'eldiary_v1',
  quiz: 'elab_quiz_v1',
  write: 'engWriteB1_v1',
  voca: 'elab_voca_v1',
} as const;

export const IDB_NAME = 'tabloEnglishLab';
export const IDB_VERSION = 1;

export const SETTINGS_KEYS = ['activity', 'folders', 'geminiKey', 'sbKey', 'sbUrl', 'syncCode', 'syncQueue'] as const;
export type SettingsKey = (typeof SETTINGS_KEYS)[number];

export const KV_KEYS = { geminiKey: 'geminiKey', voca: 'voca_v1' } as const;

export const SYNCED_STORES = ['vocab', 'videos'] as const;
export type SyncedStore = (typeof SYNCED_STORES)[number];
