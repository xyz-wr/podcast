import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/legacy';
import { loadGtm, trackTabView } from './analytics/gtm';
import { App } from './app/App';
import { useAppStore } from './store/app';
import { startSync } from './sync/bootstrap';
import { initTts } from './speech/tts';

loadGtm();
trackTabView(useAppStore.getState().tab);   // legacy 는 시작할 때 tabTo() 로 첫 화면을 보냈다
void startSync();
initTts();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
