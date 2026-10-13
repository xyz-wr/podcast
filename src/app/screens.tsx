import type { ReactNode } from 'react';
import type { TabId } from './tabs';

export interface ScreenDef {
  id: string;          // legacy <section id="…">
  inMain: boolean;     // legacy 에서 <main> 안에 있는가
  render?: () => ReactNode;
}

// legacy 의 화면 id 와 위치를 그대로 따른다. 탭 id 와 화면 id 가 다른 경우가 있다 (learn → screen-library).
export const SCREENS: Record<TabId, ScreenDef> = {
  voca: { id: 'screen-voca', inMain: true },
  conv: { id: 'screen-conv', inMain: true },
  wquiz: { id: 'screen-wquiz', inMain: false },
  learn: { id: 'screen-library', inMain: true },
  video: { id: 'screen-video', inMain: false },
  settings: { id: 'screen-settings', inMain: true },
};
