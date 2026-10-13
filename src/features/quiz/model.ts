import { qBuildPool, qGrade, qLookup, qRefill, qShuffle, qzWords } from '../../core/legacy/quiz-core.js';
import conv from '../../data/conv.json';
import { LS_KEYS } from '../../storage/keys';
import { lsGetJSON, lsSetJSON } from '../../storage/local';

export type Tense = 'present' | 'past' | 'future' | 'progressive';
export const TENSE_LABEL: Record<Tense, string> = { present: '현재형', past: '과거형', future: '미래형', progressive: '진행형' };

export interface QuizItem {
  id: string; folderId: string; titleKo: string; expression: string; meaningKo: string; tense: Tense; ko: string; en: string;
}
export interface Grade { ok: boolean; ratio: number; hasExpr: boolean; missing: string[]; extra: string[] }
export interface Result { id: string; ok: boolean; corrected: boolean }
export interface Round { queue: string[]; round: number; cursor: number; results: Result[] }
/** legacy elab_quiz_v1 과 같은 형식 */
export interface MainState extends Round { completed: Record<string, { wrong: number }>; wrong: Record<string, number> }
/** 틀렸던 문장 복습 세션 (저장하지 않음) */
export interface ReviewState extends Round { pool: string[]; passed: Record<string, 1> }
export interface Listen { words: string[]; order: number[]; picked: number[]; done: boolean; bad: number }

const FOLDERS = conv.folders;
type Rand = () => number;

/** 문장 id = "<folderId>|<cardIndex>|<tense>" */
export const POOL: string[] = qBuildPool(FOLDERS);
export const lookup = (id: string): QuizItem | null => qLookup(FOLDERS, id) as QuizItem | null;
export const grade = (text: string, it: QuizItem): Grade => qGrade(text, it.expression, it.en);

export const blankMain = (): MainState => ({ completed: {}, wrong: {}, queue: [], round: 1, cursor: 0, results: [] });

export function loadMain(): MainState {
  const s = lsGetJSON<Partial<MainState> | null>(LS_KEYS.quiz, {}) ?? {};
  return {
    completed: s.completed || {}, wrong: s.wrong || {},
    queue: Array.isArray(s.queue) ? s.queue : [],
    round: s.round || 1, cursor: s.cursor || 0,
    results: Array.isArray(s.results) ? s.results : [],
  };
}

export const saveMain = (s: MainState): void => lsSetJSON(LS_KEYS.quiz, s);

/** legacy startRound: 남은 문장을 유지하고 5개까지 채워 섞는다. */
export function newRound<R extends Round>(r: R, done: Record<string, unknown>, pool: string[], rand?: Rand): R {
  const queue = qShuffle(qRefill(r.queue.filter(id => !done[id]), pool, done, rand), rand);
  return { ...r, queue, cursor: 0, results: [] };
}

export const wrongIds = (s: MainState): string[] => Object.keys(s.completed).filter(id => s.completed[id].wrong > 0);

export function startListen(en: string, rand?: Rand): Listen {
  const words: string[] = qzWords(en);
  return { words, order: qShuffle(words.map((_, i) => i), rand), picked: [], done: false, bad: -1 };
}

/** 같은 단어가 여러 개일 수 있으므로 인덱스가 아니라 글자로 비교한다. */
export function pickTile(l: Listen, i: number): Listen {
  if(l.done) return l;
  if(l.words[i] !== l.words[l.picked.length]) return { ...l, bad: i };
  const picked = [...l.picked, i];
  return { ...l, bad: -1, picked, done: picked.length === l.words.length };
}

export const nextRate = (r: number): number => (r === 1 ? 0.75 : r === 0.75 ? 0.5 : 1);
