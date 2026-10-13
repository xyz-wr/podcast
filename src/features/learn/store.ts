import { create } from 'zustand';
import { idbAll, idbByIndex, idbDelRaw, idbGet } from '../../storage/idb';
import { registerSyncHook } from '../../sync/engine';
import { idbDel, idbPut } from '../../sync/repo';
import { askConfirm, askText, toast } from '../../ui/store';
import {
  extractVideoId, fetchTitle, loadFolders, saveFolders, sortVideos, uid,
  type Folder, type VFilter, type Video, type VocabItem,
} from './model';

export type LearnScreen = { name: 'library' } | { name: 'study'; id: string };

interface Data {
  videos: Video[];
  vocab: VocabItem[];
  folders: Folder[];
  loaded: boolean;
  seg: 'videos' | 'words';
  vfilter: VFilter;
  screen: LearnScreen;
  current: Video | null;
  movingVideoId: string | null;
  addOpen: boolean;
}
interface Actions {
  loadAll(): Promise<void>;
  setSeg(seg: 'videos' | 'words'): void;
  setFilter(f: VFilter): void;
  openAdd(): void;
  closeAdd(): void;
  addVideo(url: string): Promise<boolean>;
  removeResume(id: string): Promise<void>;
  deleteVideo(id: string): Promise<void>;
  createFolder(): Promise<string | null>;
  renameFolder(id: string): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  openFolderPicker(videoId: string): void;
  closeFolderPicker(): void;
  moveToFolder(fid: string | null): Promise<void>;
  newFolderThenMove(): Promise<void>;
  openVideo(id: string): Promise<void>;
  renameVideo(): Promise<void>;
  backToLibrary(): Promise<void>;
  delVocab(id: string): Promise<void>;
}
export type LearnState = Data & Actions;

export const initialLearnState = (): Data => ({
  videos: [], vocab: [], folders: [], loaded: false, seg: 'videos', vfilter: 'all',
  screen: { name: 'library' }, current: null, movingVideoId: null, addOpen: false,
});

export const useLearnStore = create<LearnState>()((set, get) => {
  /** legacy pruneEmptyFolder: 영상이 빠져나가 비게 된 폴더는 자동 삭제 (영상 제거 때만 호출) */
  const pruneEmptyFolder = async (fid: string | null): Promise<void> => {
    if(!fid || !get().folders.some(f => f.id === fid)) return;
    const all = await idbAll<Video>('videos');
    if(all.some(v => v.folderId === fid)) return;
    const folders = get().folders.filter(f => f.id !== fid);
    set({ folders });
    await saveFolders(folders);
  };

  return {
    ...initialLearnState(),

    loadAll: async () => {
      const videos = sortVideos(await idbAll<Video>('videos'));
      const vocab = await idbAll<VocabItem>('vocab');
      const folders = await loadFolders();
      set({ videos, vocab, folders, loaded: true });
    },

    setSeg: seg => set({ seg }),
    setFilter: vfilter => set({ vfilter }),
    openAdd: () => set({ addOpen: true }),
    closeAdd: () => set({ addOpen: false }),

    addVideo: async url => {
      const youtubeId = extractVideoId(url);
      if(!youtubeId){ toast('YouTube 주소/ID를 확인해주세요'); return false; }
      toast('제목 불러오는 중…');
      const title = (await fetchTitle(youtubeId)) || '새 영상';
      const now = Date.now();
      const v: Video = { id: uid(), youtubeId, title, folderId: null, lines: [], createdAt: now, lastStudiedAt: now };
      await idbPut('videos', v);
      set({ addOpen: false });
      await get().loadAll();
      await get().openVideo(v.id);
      return true;
    },

    removeResume: async id => {
      const v = get().videos.find(x => x.id === id);
      if(!v) return;
      const { resume: _drop, ...rest } = v;
      await idbPut('videos', rest);
      await get().loadAll();
    },

    deleteVideo: async id => {
      const v = await idbGet<Video>('videos', id);
      if(!v) return;
      if(!await askConfirm('영상 삭제', '“' + (v.title || '이 영상') + '” 영상과 이 영상에서 담은 단어가 함께 삭제돼요.')) return;
      await idbDel('videos', id);
      for(const x of await idbByIndex<VocabItem>('vocab', 'videoId', id)) await idbDel('vocab', x.id);
      try { for(const x of await idbByIndex<{ id: string }>('recordings', 'videoId', id)) await idbDelRaw('recordings', x.id); } catch { /* legacy 와 동일 */ }
      if(get().current?.id === id) set({ current: null });
      await pruneEmptyFolder(v.folderId);
      await get().loadAll();
      toast('영상을 삭제했어요');
    },

    createFolder: async () => {
      const name = await askText('새 폴더', '', '폴더 이름', '만들기');
      if(!name) return null;
      const f: Folder = { id: uid(), name };
      await saveFolders([...get().folders, f]);
      await get().loadAll();
      return f.id;
    },

    renameFolder: async id => {
      const f = get().folders.find(x => x.id === id);
      if(!f) return;
      const name = await askText('폴더 이름', f.name, '', '저장');
      if(!name) return;
      const folders = get().folders.map(x => (x.id === id ? { ...x, name } : x));
      await saveFolders(folders);
      set({ folders });
    },

    deleteFolder: async id => {
      const f = get().folders.find(x => x.id === id);
      if(!f) return;
      if(!await askConfirm('폴더 삭제', '“' + f.name + '” 폴더를 삭제할까요? 안의 영상은 미분류로 이동해요.', '삭제', '📁')) return;
      for(const v of get().videos) if(v.folderId === id) await idbPut('videos', { ...v, folderId: null });
      await saveFolders(get().folders.filter(x => x.id !== id));
      await get().loadAll();
    },

    openFolderPicker: videoId => set({ movingVideoId: videoId }),
    closeFolderPicker: () => set({ movingVideoId: null }),

    moveToFolder: async fid => {
      const v = get().videos.find(x => x.id === get().movingVideoId);
      if(!v) return;
      const old = v.folderId;
      await idbPut('videos', { ...v, folderId: fid });
      if(old && old !== fid) await pruneEmptyFolder(old);
      set({ movingVideoId: null });
      await get().loadAll();
      toast('이동했어요');
    },

    newFolderThenMove: async () => {
      const id = get().movingVideoId;
      const fid = await get().createFolder();
      if(fid){ set({ movingVideoId: id }); await get().moveToFolder(fid); }
    },

    openVideo: async id => {
      const v = await idbGet<Video>('videos', id);
      if(!v) return;
      const current = await idbPut('videos', { ...v, lastStudiedAt: Date.now() });
      set({ current, screen: { name: 'study', id } });
    },

    renameVideo: async () => {
      const cur = get().current;
      if(!cur) return;
      const title = await askText('영상 제목', cur.title, '', '저장');
      if(!title) return;
      set({ current: await idbPut('videos', { ...cur, title }) });
    },

    backToLibrary: async () => {
      set({ screen: { name: 'library' } });
      await get().loadAll();   // legacy 는 다시 읽지 않아 목록이 옛 상태로 남았다
    },

    delVocab: async id => {
      const v = get().vocab.find(x => x.id === id);
      if(!v) return;
      if(!await askConfirm('단어 삭제', '“' + v.term + '”을(를) 단어장에서 삭제할까요?')) return;
      await idbDel('vocab', id);
      set({ vocab: get().vocab.filter(x => x.id !== id) });
    },
  };
});

// legacy: 동기화가 끝나면 loadAll 로 목록을 다시 읽는다
registerSyncHook(() => useLearnStore.getState().loadAll());
