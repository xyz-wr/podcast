import { getSetting, putSetting } from '../../storage/idb';

/** legacy videos 기록 (IndexedDB, 동기화 대상) */
export interface Line { idx: number; time: number | null; end: number | null; en: string; ko: string; chapter: string; idioms?: string[] }
export interface Video {
  id: string; youtubeId: string; title: string; folderId: string | null; lines: Line[];
  createdAt: number; lastStudiedAt: number;
  resume?: { time: number; at: number };
  bookmark?: { idx: number; time: number | null };
  updatedAt?: number;
}
/** legacy vocab 기록 (IndexedDB, 동기화 대상). 보카 탭(elab_voca_v1)과는 별개다. */
export interface VocabItem {
  id: string; term: string; note: string; type: string; createdAt: number;
  videoId?: string; context?: string; contextKo?: string; time?: number | null; end?: number | null;
  srs?: { box: number; dueAt: number; history: unknown[] };
  examples?: Array<{ en: string; ko: string; cefr: string; createdAt: number }>;
  lastCefr?: string; source?: string; sourceLabel?: string; updatedAt?: number;
}
export interface Folder { id: string; name: string }
export type VFilter = 'all' | 'word' | 'idiom' | 'slang';

export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function fmt(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  if(m >= 60){ const h = Math.floor(m / 60); return h + ':' + String(m % 60).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
  return m + ':' + String(s).padStart(2, '0');
}

export function extractVideoId(input: string): string | null {
  input = (input || '').trim();
  const ps = [/youtu\.be\/([a-zA-Z0-9_-]{6,})/, /[?&]v=([a-zA-Z0-9_-]{6,})/, /embed\/([a-zA-Z0-9_-]{6,})/, /shorts\/([a-zA-Z0-9_-]{6,})/];
  for(const p of ps){ const m = input.match(p); if(m) return m[1]; }
  return /^[a-zA-Z0-9_-]{6,}$/.test(input) ? input : null;
}

export const thumb = (youtubeId: string): string => `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;

/** legacy loadAll 정렬: 최근 학습 순 (없으면 만든 시각) */
export const sortVideos = (vs: Video[]): Video[] =>
  [...vs].sort((a, b) => (b.lastStudiedAt || b.createdAt) - (a.lastStudiedAt || a.createdAt));

/** legacy renderResumeRow: 이어보기 위치가 있는 영상, 저장 시각 최근 순 8개 */
export const resumeList = (vs: Video[]): Video[] =>
  vs.filter(v => v.resume && v.resume.time != null).sort((a, b) => (b.resume!.at || 0) - (a.resume!.at || 0)).slice(0, 8);

export interface FolderGroup { folder: Folder | null; videos: Video[] }
/** legacy renderLibrary 묶음: 폴더 순서대로, 마지막에 미분류(folder=null) */
export function groupByFolder(vs: Video[], folders: Folder[]): FolderGroup[] {
  const known = new Set(folders.map(f => f.id));
  return [
    ...folders.map(f => ({ folder: f, videos: vs.filter(v => v.folderId === f.id) })),
    { folder: null, videos: vs.filter(v => !(v.folderId && known.has(v.folderId))) },
  ];
}

/** legacy renderLearnVocab: 캡처 단어 제외, 최신 순, 종류 필터 */
export function learnVocab(vocab: VocabItem[], filter: VFilter): VocabItem[] {
  const list = vocab.filter(v => v.source !== 'capture').sort((a, b) => b.createdAt - a.createdAt);
  return filter === 'all' ? list : list.filter(v => v.type === filter);
}

/** legacy fetchTitle: YouTube oEmbed. 실패하면 '' */
export async function fetchTitle(youtubeId: string): Promise<string> {
  try {
    const r = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + youtubeId) + '&format=json');
    if(!r.ok) return '';
    const j = await r.json();
    return String(j.title || '').trim();
  } catch { return ''; }
}

/** legacy: settings.folders 의 value 는 JSON 문자열이다 (동기화하지 않음) */
export async function loadFolders(): Promise<Folder[]> {
  try {
    const row = await getSetting<string>('folders');
    return row && row.value ? JSON.parse(row.value) : [];
  } catch { return []; }
}
export const saveFolders = (folders: Folder[]): Promise<void> => putSetting({ key: 'folders', value: JSON.stringify(folders) });
