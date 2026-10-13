import { create } from 'zustand';
import { LS_KEYS } from '../../storage/keys';
import { lsGetJSON, lsSetJSON } from '../../storage/local';
import type { Folder } from './data';

/** legacy elab_progress_v1 과 같은 형식. reveal 은 지금 쓰지 않지만 보존한다. */
export interface Progress { done: Record<string, 1>; marks: Record<string, 1>; reveal: boolean }
export type ConvView =
  | { name: 'home' } | { name: 'marks' }
  | { name: 'cat'; cid: string } | { name: 'folder'; fid: string } | { name: 'card'; fid: string; idx: number };
export interface Toast { msg: string; n: number; show: boolean }

export const ckey = (fid: string, idx: number): string => fid + '#' + idx;
export const isDone = (p: Progress, fid: string, idx: number): boolean => !!p.done[ckey(fid, idx)];
export const isMark = (p: Progress, fid: string, idx: number): boolean => !!p.marks[ckey(fid, idx)];
export const folderDone = (p: Progress, f: Folder): number => f.cards.filter((_, i) => isDone(p, f.id, i)).length;

export function loadProgress(): Progress {
  const s = lsGetJSON<Partial<Progress> | null>(LS_KEYS.progress, {}) ?? {};
  return { done: s.done || {}, marks: s.marks || {}, reveal: !!s.reveal };
}

function toggle(map: Record<string, 1>, key: string): Record<string, 1> {
  const out = { ...map };
  if(out[key]) delete out[key]; else out[key] = 1;
  return out;
}

interface Data { progress: Progress; view: ConvView; searchQ: string; toast: Toast }
interface Actions {
  nav(view: ConvView): void;
  setSearch(q: string): void;
  toggleDone(fid: string, idx: number): void;
  toggleMark(fid: string, idx: number): void;
  resetProgress(): void;
  showToast(msg: string): void;
  hideToast(): void;
}

export const initialConvState = (): Data => ({
  progress: loadProgress(), view: { name: 'home' }, searchQ: '', toast: { msg: '', n: 0, show: false },
});

export const useConvStore = create<Data & Actions>()(set => ({
  ...initialConvState(),
  nav: view => set({ view }),
  setSearch: searchQ => set({ searchQ }),
  toggleDone: (fid, idx) => set(s => ({ progress: { ...s.progress, done: toggle(s.progress.done, ckey(fid, idx)) } })),
  toggleMark: (fid, idx) => set(s => ({ progress: { ...s.progress, marks: toggle(s.progress.marks, ckey(fid, idx)) } })),
  resetProgress: () => set(s => ({ progress: { ...s.progress, done: {}, marks: {} } })),
  showToast: msg => set(s => ({ toast: { msg, n: s.toast.n + 1, show: true } })),
  hideToast: () => set(s => ({ toast: { ...s.toast, show: false } })),
}));

// legacy saveState: 진도가 바뀔 때마다 저장
useConvStore.subscribe((s, prev) => { if(s.progress !== prev.progress) lsSetJSON(LS_KEYS.progress, s.progress); });
