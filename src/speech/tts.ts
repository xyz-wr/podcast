import { rankVoices } from '../core/legacy/quiz-core.js';
import { LS_KEYS } from '../storage/keys';
import { lsGetRaw, lsSetRaw } from '../storage/local';

// legacy quiz-module 의 음성 처리. 퀴즈·회화·설정(목소리 선택)이 함께 쓴다.
let enVoice: SpeechSynthesisVoice | null = null;

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

export function enVoiceList(): SpeechSynthesisVoice[] {
  const s = synth();
  return s ? (rankVoices(s.getVoices()) as SpeechSynthesisVoice[]) : [];
}

export function pickVoice(): void {
  const ranked = enVoiceList();
  if(!ranked.length){ enVoice = null; return; }
  const saved = lsGetRaw(LS_KEYS.voice);
  enVoice = (saved && ranked.find(v => v.name === saved)) || ranked[0];
}

export const currentVoice = (): SpeechSynthesisVoice | null => enVoice;

export function setEnVoice(name: string): void {
  const v = enVoiceList().find(x => x.name === name);
  if(!v) return;
  enVoice = v;
  lsSetRaw(LS_KEYS.voice, name);
}

export function speak(text: string, rate = 1): void {
  const s = synth();
  if(!s) return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if(!enVoice) pickVoice();
  u.lang = enVoice ? enVoice.lang : 'en-US';
  u.rate = rate;
  u.pitch = 1;
  if(enVoice){ try { u.voice = enVoice; } catch { enVoice = null; } }
  s.speak(u);
}

// 음성 목록은 비동기로 로드된다. 목록보다 먼저 말하면 영어 대신 기기 기본 음성이 잡히므로 기다린다.
export function whenVoicesReady(cb: () => void): void {
  const s = synth();
  if(!s) return cb();
  if(s.getVoices().length){ if(!enVoice) pickVoice(); return cb(); }
  let fired = false;
  const go = () => { if(fired) return; fired = true; pickVoice(); cb(); };
  s.addEventListener('voiceschanged', go, { once: true });
  setTimeout(go, 1500);
}

export function initTts(): void {
  const s = synth();
  if(!s) return;
  pickVoice();
  s.addEventListener('voiceschanged', pickVoice);
}

export function resetTtsForTests(): void { enVoice = null; }
