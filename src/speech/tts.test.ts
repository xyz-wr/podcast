import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { currentVoice, enVoiceList, initTts, resetTtsForTests, setEnVoice, speak, whenVoicesReady } from './tts';

type V = { name: string; lang: string; localService?: boolean };
let voices: V[];
let listeners: Record<string, Array<() => void>>;
const spoken: Array<{ text: string; lang: string; rate: number; voice: unknown }> = [];

class FakeUtterance {
  text: string; lang = ''; rate = 1; pitch = 1; voice: unknown = null;
  constructor(text: string){ this.text = text; }
}

beforeEach(() => {
  localStorage.clear();
  resetTtsForTests();
  spoken.length = 0;
  listeners = {};
  voices = [
    { name: 'Microsoft David - English (United States)', lang: 'en-US' },
    { name: 'Google US English', lang: 'en-US' },
    { name: 'Google 한국의', lang: 'ko-KR' },
  ];
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => voices,
    cancel: vi.fn(),
    speak: (u: FakeUtterance) => spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice }),
    addEventListener: (type: string, fn: () => void) => { (listeners[type] ||= []).push(fn); },
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('영어 음성만, 품질 순으로 고른다', () => {
  expect(enVoiceList().map(v => v.name)).toEqual(['Google US English', 'Microsoft David - English (United States)']);
  initTts();
  expect(currentVoice()?.name).toBe('Google US English');
});

it('elab_voice 에 저장된 음성을 우선한다', () => {
  localStorage.setItem('elab_voice', 'Microsoft David - English (United States)');
  initTts();
  expect(currentVoice()?.name).toBe('Microsoft David - English (United States)');
});

it('setEnVoice 는 목록에 있는 음성만 저장한다', () => {
  setEnVoice('없는 음성');
  expect(localStorage.getItem('elab_voice')).toBeNull();
  setEnVoice('Microsoft David - English (United States)');
  expect(localStorage.getItem('elab_voice')).toBe('Microsoft David - English (United States)');
  expect(currentVoice()?.name).toBe('Microsoft David - English (United States)');
});

it('speak: 고른 음성·언어·속도로 말한다', () => {
  speak('Hello there.', 0.75);
  expect(spoken).toEqual([{ text: 'Hello there.', lang: 'en-US', rate: 0.75, voice: voices[1] }]);
});

it('whenVoicesReady: 목록이 비어 있으면 voiceschanged 를 기다린다', () => {
  const real = voices; voices = [];
  const cb = vi.fn();
  whenVoicesReady(cb);
  expect(cb).not.toHaveBeenCalled();
  voices = real;
  listeners.voiceschanged.forEach(f => f());
  expect(cb).toHaveBeenCalledTimes(1);
  expect(currentVoice()?.name).toBe('Google US English');
});

it('whenVoicesReady: 이벤트가 안 와도 1.5초 뒤 한 번만 실행', () => {
  vi.useFakeTimers();
  voices = [];
  const cb = vi.fn();
  whenVoicesReady(cb);
  vi.advanceTimersByTime(1500);
  listeners.voiceschanged.forEach(f => f());
  expect(cb).toHaveBeenCalledTimes(1);
});
