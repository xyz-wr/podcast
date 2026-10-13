// legacy #tabbar 와 같은 순서·아이콘·이름
export const TABS = [
  { id: 'voca', icon: '🔤', label: '보카' },
  { id: 'conv', icon: '💬', label: '회화' },
  { id: 'wquiz', icon: '🎯', label: '퀴즈' },
  { id: 'learn', icon: '▶', label: '학습' },
  { id: 'video', icon: '🎥', label: '영상' },
  { id: 'settings', icon: '⚙', label: '더보기' },
] as const;

export type TabId = (typeof TABS)[number]['id'];
export const DEFAULT_TAB: TabId = 'wquiz';   // legacy restoreTab() 의 기본값
export const isTabId = (v: unknown): v is TabId => TABS.some(t => t.id === v);
export const tabLabel = (id: TabId): string => TABS.find(t => t.id === id)!.label;
