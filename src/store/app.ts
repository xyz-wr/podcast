import { create } from 'zustand';
import { trackTabView } from '../analytics/gtm';
import { DEFAULT_TAB, isTabId, type TabId } from '../app/tabs';
import { LS_KEYS } from '../storage/keys';
import { lsGetRaw, lsSetRaw } from '../storage/local';

export function initialTab(): TabId {
  const v = lsGetRaw(LS_KEYS.tab);
  return isTabId(v) ? v : DEFAULT_TAB;
}

interface AppState {
  tab: TabId;
  setTab: (tab: TabId) => void;
}

export const useAppStore = create<AppState>()(set => ({
  tab: initialTab(),
  setTab: tab => {
    lsSetRaw(LS_KEYS.tab, tab);
    trackTabView(tab);
    window.scrollTo(0, 0);
    set({ tab });
  },
}));
