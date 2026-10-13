# React 이관 Phase 4a (학습 탭: 영상 목록·폴더·단어 목록) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학습 탭("내 영상")의 목록 부분을 옮긴다. 영상 목록(폴더별 묶음, 이어보기 줄), 영상 추가(YouTube 주소 → 제목 자동), 폴더 만들기·이름 변경·삭제·영상 이동(빈 폴더 자동 정리), 영상 삭제(담은 단어 함께 삭제), 단어 목록(필터, 삭제)이 대상이다. 함께 쓰는 확인창·입력창·토스트도 만든다.

**Architecture:**
- `src/ui/`: legacy `askConfirm`/`askText`/`toast`를 Promise를 돌려주는 함수와 전역 `DialogHost`로 옮긴다. 이후 Phase도 이 모듈을 쓴다.
- `src/features/learn/model.ts`: 타입(legacy IndexedDB 기록 형식 그대로)과 순수 함수.
- `src/features/learn/store.ts`: Zustand 스토어가 legacy `loadAll`·폴더·영상 동작을 옮긴다. 영상·단어는 동기화되는 `idbPut`/`idbDel`(Phase 1)로 쓰고, 폴더는 legacy처럼 `settings.folders`에 **JSON 문자열**로 저장한다(동기화 안 함). 동기화가 끝나면 다시 읽도록 `registerSyncHook`에 `loadAll`을 등록한다.

**Tech Stack:** React 19, Zustand 5, IndexedDB(fake-indexeddb로 테스트), Vitest + Testing Library, legacy CSS(`base.css`).

**공통 규칙:** [로드맵](2026-10-13-react-migration-roadmap.md)을 따른다. `videos`·`vocab` 기록과 `settings.folders`의 형식을 바꾸지 않는다.

**Phase 4 전체 나눔** (조사 결과 학습 탭 실제 코드 약 900줄):
- **4a (이 문서):** 목록·폴더·영상 추가/삭제·이어보기 줄·단어 목록. 학습 화면은 제목·뒤로 가기·제목 바꾸기만 있는 임시 화면.
- **4b:** 자막 처리(SRT/VTT/일반 텍스트/한영 정렬/JSON, Gemini 보조) 순수 로직과 자막 입력 창.
- **4c:** 학습 화면(YouTube 플레이어, 구간 반복, 이어보기 저장, 북마크, 자막 표시).
- **4d:** 단어 담기(선택 막대, Gemini/Google 번역 보강), 단어 상세(뜻 수정, 예문 생성·피드백, 음성 입력), 단어에서 영상 구간으로 이동.

**이관하지 않는 것** (legacy에서 도달 불가 또는 쓰이지 않음, 2026-10-13 결정과 같은 원칙): 옛 단어 퀴즈(`screen-quiz`, SRS), 녹음(`recordings`에 쓰는 코드 없음, 영상 삭제 시 함께 지우는 것만 유지), 스트릭 기록(`logActivity`, `settings.activity`), `updateBadges`(대상 요소가 없음), 캡처 단어(학습 목록은 원래 `source:'capture'`를 뺀다).

**legacy와 의도적으로 다른 점 (개선):**
- 학습 화면에서 뒤로 가면 목록을 다시 읽는다(legacy는 옛 목록을 그대로 보여 줌).
- 확인창·입력창은 다른 창보다 위에 뜬다(legacy는 폴더 이동 창에서 "새 폴더"를 누르면 입력창이 폴더 창 아래에 깔릴 수 있음).
- 확인창이 떠 있는 상태에서 새 확인창을 열면 앞의 것은 "취소"로 끝난다(legacy는 앞의 Promise가 끝나지 않음).

**legacy 참고 위치** (`legacy/index.html`): 학습 목록 마크업 `<section id="screen-library">`(246–265행), 모달 `addVidModal`·`textModal`·`folderModal`·`confirmModal`·`#toast`(4327–4398행), 도우미 `toast`·`fmt`·`extractVideoId`·`askConfirm`·`askText`(4433–4457행), 목록 `/* ============ library ============ */`(4712–4800행), 단어 목록 `vcardEl`·`renderLearnVocab`·`learnSegTo`(4969–5004행), `delVocab`(5147행).

---

## File Structure

| 파일 | 역할 |
|---|---|
| `src/ui/store.ts` | 확인창·입력창·토스트 상태와 `askConfirm`, `askText`, `toast` |
| `src/ui/DialogHost.tsx` | legacy `#textModal`, `#confirmModal`, `#toast` 마크업 |
| `src/features/learn/model.ts` | 타입, `uid`, `fmt`, `extractVideoId`, 정렬·이어보기·폴더 묶음·단어 필터, `fetchTitle`, 폴더 읽기/저장 |
| `src/features/learn/store.ts` | 학습 탭 상태와 동작 |
| `src/features/learn/views.tsx` | 목록, 이어보기 줄, 영상 카드, 단어 카드, 영상 추가 창, 폴더 이동 창, 임시 학습 화면 |
| `src/features/learn/LearnScreen.tsx` | 학습 탭 진입점 |
| `src/app/App.tsx`, `src/app/screens.tsx` | `DialogHost` 연결, `learn` 연결 |

---

### Task 1: 공용 확인창·입력창·토스트

**Files:**
- Create: `src/ui/store.ts`, `src/ui/DialogHost.tsx`, `src/ui/dialogs.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: 테스트** — `src/ui/dialogs.test.tsx`

```tsx
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DialogHost } from './DialogHost';
import { askConfirm, askText, closeDialog, toast, useUiStore } from './store';

beforeEach(() => useUiStore.setState({ dialog: null, toast: { msg: '', n: 0, show: false } }));
afterEach(() => vi.useRealTimers());

it('확인창: 확인 → true, 취소 → false, 바깥 클릭 → false', async () => {
  render(<DialogHost />);
  let p = askConfirm('영상 삭제', '정말요?');
  await act(async () => {});
  expect(document.querySelector('#confirmModal')).toHaveClass('show');
  expect(screen.getByText('정말요?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  await expect(p).resolves.toBe(true);
  expect(document.querySelector('#confirmModal')).not.toHaveClass('show');

  p = askConfirm('폴더 삭제', '폴더요?', '지우기', '📁');
  await act(async () => {});
  expect(screen.getByText('📁')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  await expect(p).resolves.toBe(false);

  p = askConfirm('a', 'b');
  await act(async () => {});
  fireEvent.click(document.querySelector('#confirmModal')!);
  await expect(p).resolves.toBe(false);
});

it('입력창: Enter·확인은 앞뒤 공백을 뺀 값, 취소는 null', async () => {
  render(<DialogHost />);
  let p = askText('새 폴더', '', '폴더 이름', '만들기');
  await act(async () => {});
  const input = screen.getByPlaceholderText('폴더 이름');
  fireEvent.change(input, { target: { value: '  여행  ' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await expect(p).resolves.toBe('여행');

  p = askText('폴더 이름', '기존', '', '저장');
  await act(async () => {});
  expect(screen.getByDisplayValue('기존')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await expect(p).resolves.toBe('기존');

  p = askText('x');
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  await expect(p).resolves.toBeNull();
});

it('창이 떠 있을 때 새 창을 열면 앞의 것은 취소로 끝난다', async () => {
  const first = askConfirm('a', 'b');
  const second = askText('c');
  await expect(first).resolves.toBe(false);
  closeDialog(null);
  await expect(second).resolves.toBeNull();
});

it('토스트는 1.8초 뒤 사라지고, 다시 띄우면 시간을 새로 센다', () => {
  vi.useFakeTimers();
  render(<DialogHost />);
  act(() => toast('저장됨'));
  expect(document.querySelector('#toast')).toHaveClass('show');
  expect(document.querySelector('#toast')?.textContent).toBe('저장됨');
  act(() => { vi.advanceTimersByTime(1500); toast('다시'); });
  act(() => { vi.advanceTimersByTime(1500); });
  expect(document.querySelector('#toast')).toHaveClass('show');
  act(() => { vi.advanceTimersByTime(400); });
  expect(document.querySelector('#toast')).not.toHaveClass('show');
});
```

Run: `npx vitest run src/ui` → FAIL (모듈 없음)

- [ ] **Step 2: `src/ui/store.ts`**

```ts
import { create } from 'zustand';

interface ConfirmDialog {
  kind: 'confirm'; title: string; message: string; okLabel: string; icon: string;
  resolve: (v: boolean) => void;
}
interface TextDialog {
  kind: 'text'; title: string; current: string; placeholder: string; okLabel: string;
  resolve: (v: string | null) => void;
}
export type Dialog = ConfirmDialog | TextDialog;
export interface Toast { msg: string; n: number; show: boolean }

interface UiState { dialog: Dialog | null; toast: Toast }
export const useUiStore = create<UiState>()(() => ({ dialog: null, toast: { msg: '', n: 0, show: false } }));

/** 떠 있는 창을 닫고 값을 돌려준다. 확인창은 boolean, 입력창은 string|null. */
export function closeDialog(value: boolean | string | null): void {
  const d = useUiStore.getState().dialog;
  if(!d) return;
  useUiStore.setState({ dialog: null });
  if(d.kind === 'confirm') d.resolve(value === true);
  else d.resolve(typeof value === 'string' ? value : null);
}

function open(d: Dialog): void {
  closeDialog(null);   // 앞의 창은 취소로 끝낸다 (확인창이면 false, 입력창이면 null)
  useUiStore.setState({ dialog: d });
}

/** legacy askConfirm(title, message, okLabel, icon) */
export function askConfirm(title: string, message: string, okLabel = '삭제', icon = '🗑️'): Promise<boolean> {
  return new Promise(resolve => open({ kind: 'confirm', title, message, okLabel, icon, resolve }));
}

/** legacy askText(title, current, placeholder, okLabel) — 확인하면 앞뒤 공백을 뺀 값, 취소하면 null */
export function askText(title: string, current = '', placeholder = '', okLabel = '확인'): Promise<string | null> {
  return new Promise(resolve => open({ kind: 'text', title, current, placeholder, okLabel, resolve }));
}

/** legacy toast(m): 1.8초 동안 표시 */
export function toast(msg: string): void {
  useUiStore.setState(s => ({ toast: { msg, n: s.toast.n + 1, show: true } }));
}
export function hideToast(): void {
  useUiStore.setState(s => ({ toast: { ...s.toast, show: false } }));
}
```


- [ ] **Step 3: `src/ui/DialogHost.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { closeDialog, hideToast, useUiStore, type Dialog } from './store';

function TextBody({ d }: { d: Extract<Dialog, { kind: 'text' }> }) {
  const [value, setValue] = useState(d.current);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 60); return () => clearTimeout(t); }, []);
  return (
    <div className="confirm-card" style={{ textAlign: 'left' }}>
      <h3 id="textTitle" style={{ textAlign: 'center' }}>{d.title}</h3>
      <input ref={ref} type="text" id="textInput" placeholder={d.placeholder} value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if(e.key === 'Enter') closeDialog(value.trim()); }} />
      <div className="cf-btns" style={{ marginTop: 14 }}>
        <button className="ghost" id="textCancel" onClick={() => closeDialog(null)}>취소</button>
        <button className="secondary" id="textOk" onClick={() => closeDialog(value.trim())}>{d.okLabel}</button>
      </div>
    </div>
  );
}

/** legacy #textModal, #confirmModal, #toast. 페이지의 다른 창보다 뒤에 그려서 위에 뜨게 한다. */
export function DialogHost() {
  const dialog = useUiStore(s => s.dialog);
  const toast = useUiStore(s => s.toast);

  useEffect(() => {
    if(!toast.show) return;
    const t = setTimeout(hideToast, 1800);
    return () => clearTimeout(t);
  }, [toast.n, toast.show]);

  const text = dialog?.kind === 'text' ? dialog : null;
  const confirm = dialog?.kind === 'confirm' ? dialog : null;
  return (
    <>
      <div className={'modal-bg' + (text ? ' show' : '')} id="textModal" style={{ alignItems: 'center' }}
        onClick={e => { if(e.target === e.currentTarget) closeDialog(null); }}>
        {text && <TextBody key={text.title + text.current} d={text} />}
      </div>
      <div className={'modal-bg' + (confirm ? ' show' : '')} id="confirmModal" style={{ alignItems: 'center' }}
        onClick={e => { if(e.target === e.currentTarget) closeDialog(false); }}>
        {confirm && (
          <div className="confirm-card">
            <div className="cf-icon" id="confirmIcon">{confirm.icon}</div>
            <h3 id="confirmTitle">{confirm.title}</h3>
            <p id="confirmMsg">{confirm.message}</p>
            <div className="cf-btns">
              <button className="ghost" id="confirmCancel" onClick={() => closeDialog(false)}>취소</button>
              <button className="danger" id="confirmOk" onClick={() => closeDialog(true)}>{confirm.okLabel}</button>
            </div>
          </div>
        )}
      </div>
      <div id="toast" className={toast.show ? 'show' : undefined}>{toast.msg}</div>
    </>
  );
}
```

- [ ] **Step 4: 앱에 붙이기** — `src/app/App.tsx`

import를 추가하고, 반환하는 JSX의 `<TabBar />` 다음 줄에 `<DialogHost />`를 넣는다.

```tsx
import { DialogHost } from '../ui/DialogHost';
```

```tsx
      <TabBar />
      <DialogHost />
```

- [ ] **Step 5: 확인 후 커밋**

Run: `npx vitest run src/ui` → 4 passed. `npm test` → 157 passed. `npx tsc --noEmit` → 출력 없음.

```bash
git add src/ui src/app/App.tsx
git commit -m "feat(ui): 공용 확인창·입력창·토스트 (legacy askConfirm·askText·toast)"
```

---

### Task 2: 학습 모델 (타입, 순수 함수, 제목 가져오기, 폴더 저장)

**Files:**
- Create: `src/features/learn/model.ts`, `src/features/learn/model.test.ts`

- [ ] **Step 1: 테스트** — `src/features/learn/model.test.ts`

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getSetting, putSetting, resetDbForTests } from '../../storage/idb';
import {
  extractVideoId, fetchTitle, fmt, groupByFolder, learnVocab, loadFolders, resumeList, saveFolders, sortVideos,
  type Video, type VocabItem,
} from './model';

const vid = (o: Partial<Video>): Video => ({ id: 'v', youtubeId: 'abcdef', title: 't', folderId: null, lines: [], createdAt: 0, lastStudiedAt: 0, ...o });
const voc = (o: Partial<VocabItem>): VocabItem => ({ id: 'w', term: 'x', note: '', type: 'word', createdAt: 0, ...o });

beforeEach(resetDbForTests);
afterEach(() => vi.unstubAllGlobals());

it('extractVideoId: 여러 주소 형식과 ID만 넣은 경우', () => {
  expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s')).toBe('dQw4w9WgXcQ');
  expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(extractVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(extractVideoId('  dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ');
  expect(extractVideoId('abc')).toBeNull();
  expect(extractVideoId('https://example.com/watch')).toBeNull();
});

it('fmt: m:ss, 1시간 넘으면 h:mm:ss, 음수는 0', () => {
  expect([fmt(5), fmt(65.9), fmt(3725), fmt(-3)]).toEqual(['0:05', '1:05', '1:02:05', '0:00']);
});

it('sortVideos: 최근 학습(없으면 만든 시각) 순', () => {
  const vs = [vid({ id: 'a', createdAt: 5, lastStudiedAt: 0 }), vid({ id: 'b', createdAt: 1, lastStudiedAt: 9 }), vid({ id: 'c', createdAt: 7, lastStudiedAt: 0 })];
  expect(sortVideos(vs).map(v => v.id)).toEqual(['b', 'c', 'a']);
});

it('resumeList: 이어보기 위치가 있는 영상만, 최근 순, 최대 8개', () => {
  const vs = Array.from({ length: 10 }, (_, i) => vid({ id: 'r' + i, resume: { time: 30, at: i } }));
  vs.push(vid({ id: 'none' }));
  const list = resumeList(vs);
  expect(list).toHaveLength(8);
  expect(list[0].id).toBe('r9');
  expect(list.some(v => v.id === 'none')).toBe(false);
});

it('groupByFolder: 폴더 순서대로, 없는 폴더를 가리키는 영상은 미분류', () => {
  const folders = [{ id: 'f1', name: '여행' }, { id: 'f2', name: '빈 폴더' }];
  const vs = [vid({ id: 'a', folderId: 'f1' }), vid({ id: 'b', folderId: 'gone' }), vid({ id: 'c' })];
  expect(groupByFolder(vs, folders).map(g => [g.folder?.id ?? null, g.videos.map(v => v.id)])).toEqual([
    ['f1', ['a']], ['f2', []], [null, ['b', 'c']],
  ]);
});

it('learnVocab: 캡처 단어 제외, 최신 순, 종류 필터', () => {
  const list = [voc({ id: 'a', type: 'word', createdAt: 1 }), voc({ id: 'b', type: 'idiom', createdAt: 3 }), voc({ id: 'c', source: 'capture', createdAt: 5 })];
  expect(learnVocab(list, 'all').map(v => v.id)).toEqual(['b', 'a']);
  expect(learnVocab(list, 'idiom').map(v => v.id)).toEqual(['b']);
});

it('fetchTitle: oEmbed 제목, 실패하면 빈 문자열', async () => {
  const f = vi.fn(async () => ({ ok: true, json: async () => ({ title: '  My Video ' }) }));
  vi.stubGlobal('fetch', f);
  expect(await fetchTitle('dQw4w9WgXcQ')).toBe('My Video');
  expect(f.mock.calls[0][0]).toBe('https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=dQw4w9WgXcQ') + '&format=json');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  expect(await fetchTitle('x')).toBe('');
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
  expect(await fetchTitle('x')).toBe('');
});

it('폴더는 legacy 처럼 settings.folders 에 JSON 문자열로', async () => {
  expect(await loadFolders()).toEqual([]);
  await saveFolders([{ id: 'f1', name: '여행' }]);
  expect(await getSetting('folders')).toEqual({ key: 'folders', value: '[{"id":"f1","name":"여행"}]' });
  expect(await loadFolders()).toEqual([{ id: 'f1', name: '여행' }]);
  await putSetting({ key: 'folders', value: '{oops' });
  expect(await loadFolders()).toEqual([]);
});
```

Run: `npx vitest run src/features/learn/model` → FAIL

- [ ] **Step 2: `src/features/learn/model.ts`**

```ts
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
```

Run: `npx vitest run src/features/learn/model` → 8 passed. `npx tsc --noEmit` → 출력 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/features/learn/model.ts src/features/learn/model.test.ts
git commit -m "feat(learn): 학습 탭 모델 (기록 형식, 주소 해석, 정렬·묶음, 제목 가져오기, 폴더 저장)"
```

---

### Task 3: 학습 스토어 (legacy 목록·폴더·영상 동작)

**Files:**
- Create: `src/features/learn/store.ts`, `src/features/learn/store.test.ts`

- [ ] **Step 1: 테스트** — `src/features/learn/store.test.ts`

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const ui = vi.hoisted(() => ({ confirm: true, text: '' as string | null, toasts: [] as string[] }));
vi.mock('../../ui/store', () => ({
  askConfirm: vi.fn(async () => ui.confirm),
  askText: vi.fn(async () => ui.text),
  toast: (m: string) => { ui.toasts.push(m); },
}));

import { getSetting, idbAll, idbGet, idbPutRaw, resetDbForTests } from '../../storage/idb';
import type { Video, VocabItem } from './model';
import { initialLearnState, useLearnStore } from './store';

const st = () => useLearnStore.getState();
const vid = (o: Partial<Video>): Video => ({ id: 'v', youtubeId: 'abcdef', title: 't', folderId: null, lines: [], createdAt: 1, lastStudiedAt: 1, ...o });

beforeEach(async () => {
  await resetDbForTests();
  ui.confirm = true; ui.text = ''; ui.toasts = [];
  useLearnStore.setState(initialLearnState());
});
afterEach(() => vi.unstubAllGlobals());

it('loadAll: legacy 기록(폴더는 JSON 문자열)을 읽고 최근 학습 순으로', async () => {
  await idbPutRaw('videos', vid({ id: 'a', lastStudiedAt: 1 }));
  await idbPutRaw('videos', vid({ id: 'b', lastStudiedAt: 9 }));
  await idbPutRaw('vocab', { id: 'w1', videoId: 'a', term: 'hit', note: '', type: 'word', createdAt: 1 });
  await idbPutRaw('settings', { key: 'folders', value: '[{"id":"f1","name":"여행"}]' });
  await st().loadAll();
  expect(st().videos.map(v => v.id)).toEqual(['b', 'a']);
  expect(st().vocab).toHaveLength(1);
  expect(st().folders).toEqual([{ id: 'f1', name: '여행' }]);
  expect(st().loaded).toBe(true);
});

it('addVideo: 잘못된 주소면 알림만, 맞으면 제목을 가져와 legacy 형식으로 저장하고 학습 화면으로', async () => {
  expect(await st().addVideo('not a url')).toBe(false);
  expect(ui.toasts).toContain('YouTube 주소/ID를 확인해주세요');
  expect(await idbAll('videos')).toEqual([]);

  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ title: 'My Video' }) })));
  expect(await st().addVideo('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  const [v] = await idbAll<Video>('videos');
  expect(v).toMatchObject({ youtubeId: 'dQw4w9WgXcQ', title: 'My Video', folderId: null, lines: [] });
  expect(Object.keys(v).sort()).toEqual(['createdAt', 'folderId', 'id', 'lastStudiedAt', 'lines', 'title', 'updatedAt', 'youtubeId']);
  expect(st().screen).toEqual({ name: 'study', id: v.id });
  expect(st().addOpen).toBe(false);
});

it('addVideo: 제목을 못 가져오면 "새 영상"', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  await st().addVideo('dQw4w9WgXcQ');
  expect((await idbAll<Video>('videos'))[0].title).toBe('새 영상');
});

it('폴더 만들기·이름 바꾸기·삭제(안의 영상은 미분류로)', async () => {
  ui.text = '여행';
  const fid = await st().createFolder();
  expect(fid).toBeTruthy();
  expect(JSON.parse((await getSetting<string>('folders'))!.value)).toEqual([{ id: fid, name: '여행' }]);
  ui.text = '해외 여행';
  await st().renameFolder(fid!);
  expect(st().folders[0].name).toBe('해외 여행');

  await idbPutRaw('videos', vid({ id: 'a', folderId: fid }));
  await st().loadAll();
  await st().deleteFolder(fid!);
  expect(st().folders).toEqual([]);
  expect((await idbGet<Video>('videos', 'a'))!.folderId).toBeNull();
});

it('이름 입력을 취소하면 폴더를 만들지 않는다', async () => {
  ui.text = null;
  expect(await st().createFolder()).toBeNull();
  expect(st().folders).toEqual([]);
});

it('영상 이동: 원래 폴더가 비면 자동 삭제, 다른 영상이 남아 있으면 유지', async () => {
  await idbPutRaw('settings', { key: 'folders', value: '[{"id":"f1","name":"A"},{"id":"f2","name":"B"}]' });
  await idbPutRaw('videos', vid({ id: 'a', folderId: 'f1' }));
  await idbPutRaw('videos', vid({ id: 'b', folderId: 'f1' }));
  await st().loadAll();
  st().openFolderPicker('a');
  await st().moveToFolder('f2');
  expect(st().folders.map(f => f.id)).toEqual(['f1', 'f2']);
  st().openFolderPicker('b');
  await st().moveToFolder(null);
  expect(st().folders.map(f => f.id)).toEqual(['f2']);
  expect((await idbGet<Video>('videos', 'b'))!.folderId).toBeNull();
  expect(st().movingVideoId).toBeNull();
  expect(ui.toasts).toContain('이동했어요');
});

it('영상 삭제: 확인 후 그 영상의 단어·녹음까지 지우고 빈 폴더 정리', async () => {
  await idbPutRaw('settings', { key: 'folders', value: '[{"id":"f1","name":"A"}]' });
  await idbPutRaw('videos', vid({ id: 'a', folderId: 'f1' }));
  await idbPutRaw('vocab', { id: 'w1', videoId: 'a', term: 'x', note: '', type: 'word', createdAt: 1 });
  await idbPutRaw('vocab', { id: 'w2', videoId: 'other', term: 'y', note: '', type: 'word', createdAt: 1 });
  await idbPutRaw('recordings', { id: 'r1', videoId: 'a' });
  await st().loadAll();

  ui.confirm = false;
  await st().deleteVideo('a');
  expect(await idbGet('videos', 'a')).toBeDefined();

  ui.confirm = true;
  await st().deleteVideo('a');
  expect(await idbGet('videos', 'a')).toBeUndefined();
  expect((await idbAll<VocabItem>('vocab')).map(v => v.id)).toEqual(['w2']);
  expect(await idbAll('recordings')).toEqual([]);
  expect(st().folders).toEqual([]);
  expect(ui.toasts).toContain('영상을 삭제했어요');
});

it('이어보기에서 빼기, 영상 열기(최근 학습 시각 갱신), 제목 바꾸기, 목록으로', async () => {
  await idbPutRaw('videos', vid({ id: 'a', resume: { time: 42, at: 5 }, lastStudiedAt: 1 }));
  await st().loadAll();
  await st().removeResume('a');
  expect((await idbGet<Video>('videos', 'a'))!.resume).toBeUndefined();

  await st().openVideo('a');
  expect(st().screen).toEqual({ name: 'study', id: 'a' });
  expect(st().current!.lastStudiedAt).toBeGreaterThan(1);
  ui.text = '새 제목';
  await st().renameVideo();
  expect((await idbGet<Video>('videos', 'a'))!.title).toBe('새 제목');
  await st().backToLibrary();
  expect(st().screen).toEqual({ name: 'library' });
  expect(st().videos[0].title).toBe('새 제목');
});

it('단어 삭제는 확인 후에만', async () => {
  await idbPutRaw('vocab', { id: 'w1', term: 'hit', note: '', type: 'word', createdAt: 1 });
  await st().loadAll();
  ui.confirm = false;
  await st().delVocab('w1');
  expect(st().vocab).toHaveLength(1);
  ui.confirm = true;
  await st().delVocab('w1');
  expect(st().vocab).toEqual([]);
  expect(await idbGet('vocab', 'w1')).toBeUndefined();
});
```

Run: `npx vitest run src/features/learn/store` → FAIL

- [ ] **Step 2: `src/features/learn/store.ts`**

```ts
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
```

Run: `npx vitest run src/features/learn` → 17 passed (model 8 + store 9). `npx tsc --noEmit` → 출력 없음.


- [ ] **Step 3: 커밋**

```bash
git add src/features/learn/store.ts src/features/learn/store.test.ts
git commit -m "feat(learn): 학습 탭 스토어 (목록·폴더·영상 추가/삭제/이동·단어 삭제, 동기화 후 다시 읽기)"
```

---

### Task 4: 학습 탭 화면

legacy `screen-library` 마크업과 `renderResumeRow`, `renderLibrary`, `videoCardHTML`, `vcardEl`, `renderLearnVocab`, `openFolderPicker`, `addVidModal`을 같은 class 이름의 JSX로 옮긴다. 단어 카드의 "상세"(단어·뜻 누르기)와 "m:ss 보기"는 4c·4d에서 붙이므로 이번에는 "준비 중" 토스트만 띄운다.

**Files:**
- Create: `src/features/learn/views.tsx`, `src/features/learn/LearnScreen.tsx`, `src/features/learn/LearnScreen.test.tsx`
- Modify: `src/app/screens.tsx`

- [ ] **Step 1: 테스트** — `src/features/learn/LearnScreen.test.tsx`

```tsx
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { idbAll, idbPutRaw, resetDbForTests } from '../../storage/idb';
import { DialogHost } from '../../ui/DialogHost';
import { useUiStore } from '../../ui/store';
import type { Video } from './model';
import { LearnScreen } from './LearnScreen';
import { initialLearnState, useLearnStore } from './store';

const vid = (o: Partial<Video>): Video => ({ id: 'v', youtubeId: 'abcdef', title: 't', folderId: null, lines: [], createdAt: 1, lastStudiedAt: 1, ...o });
// fake-indexeddb 작업이 여러 단계로 이어지므로 이벤트 루프를 여러 번 돌린다
const settle = () => act(async () => { for(let i = 0; i < 30; i++) await new Promise(r => setTimeout(r, 0)); });
const ui = () => render(<><LearnScreen /><DialogHost /></>);

beforeEach(async () => {
  await resetDbForTests();
  useLearnStore.setState(initialLearnState());
  useUiStore.setState({ dialog: null, toast: { msg: '', n: 0, show: false } });
});
afterEach(() => vi.unstubAllGlobals());

it('영상이 없으면 안내 문구', async () => {
  ui();
  await settle();
  expect(screen.getByText('아직 영상이 없어요. 위에서 YouTube 영상을 추가해보세요.')).toBeInTheDocument();
  expect(document.querySelector('#resumeRow')).toHaveStyle({ display: 'none' });
});

it('이어보기 줄, 폴더 묶음, 영상 카드(자막 줄 수·단어 수)', async () => {
  await idbPutRaw('settings', { key: 'folders', value: '[{"id":"f1","name":"여행"},{"id":"f2","name":"빈 폴더"}]' });
  await idbPutRaw('videos', vid({ id: 'a', title: '공항 영상', folderId: 'f1', resume: { time: 75, at: 1 }, lines: [
    { idx: 0, time: 0, end: 2, en: 'Hi', ko: '안녕', chapter: '' }, { idx: 1, time: 2, end: 4, en: 'Bye', ko: '잘가', chapter: '' },
  ] }));
  await idbPutRaw('videos', vid({ id: 'b', title: '미분류 영상' }));
  await idbPutRaw('vocab', { id: 'w1', videoId: 'a', term: 'board', note: '탑승하다', type: 'word', createdAt: 1 });
  ui();
  await settle();
  expect(screen.getByText('이어보기')).toBeInTheDocument();
  expect(screen.getByText('이어보기 1:15')).toBeInTheDocument();
  expect(screen.getByText('📁 여행')).toBeInTheDocument();
  expect(screen.getByText('비어 있음 (🗂로 영상 이동)')).toBeInTheDocument();
  expect(screen.getByText('미분류')).toBeInTheDocument();
  expect(screen.getByText('자막 2줄 · 단어 1개')).toBeInTheDocument();
  expect(document.querySelector<HTMLElement>('.vid-thumb')!.style.backgroundImage).toContain('i.ytimg.com/vi/abcdef/mqdefault.jpg');
});

it('단어 보기: 필터와 단어 카드', async () => {
  await idbPutRaw('videos', vid({ id: 'a', title: '공항 영상' }));
  await idbPutRaw('vocab', { id: 'w1', videoId: 'a', term: 'board', note: '탑승하다', type: 'word', context: 'Please board now.', time: 65, createdAt: 2 });
  await idbPutRaw('vocab', { id: 'w2', videoId: 'gone', term: 'hit the road', note: '', type: 'idiom', createdAt: 1 });
  ui();
  await settle();
  fireEvent.click(screen.getByText('단어'));
  expect(document.querySelectorAll('#learnVfilter .chip')).toHaveLength(4);
  expect(screen.getByText('예문: Please board now.')).toBeInTheDocument();
  expect(screen.getByText('🎬 공항 영상')).toBeInTheDocument();
  expect(screen.getByText('🎬 (삭제된 영상)')).toBeInTheDocument();
  expect(screen.getByText('1:05 보기')).toBeInTheDocument();
  expect(screen.getByText('뜻 추가하려면 탭')).toBeInTheDocument();
  fireEvent.click(screen.getByText('관용구', { selector: '.chip' }));
  expect(document.querySelectorAll('.vcard')).toHaveLength(1);
  expect(document.querySelector('.vcard .tag')?.className).toBe('tag idiom');
});

it('영상 추가 → 임시 학습 화면, 뒤로 가면 목록', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ title: 'My Video' }) })));
  ui();
  await settle();
  fireEvent.click(screen.getByRole('button', { name: '＋ 영상' }));
  fireEvent.change(screen.getByPlaceholderText('https://youtu.be/… 또는 영상 ID'), { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
  fireEvent.click(screen.getByRole('button', { name: '영상 만들기' }));
  await settle();
  expect(document.querySelector('#studyTitle')?.textContent).toBe('My Video');
  expect(document.querySelector('#studySub')?.textContent).toBe('자막 0줄');
  fireEvent.click(screen.getByRole('button', { name: '‹' }));
  await settle();
  expect(screen.getByText('My Video')).toBeInTheDocument();
  expect(await idbAll('videos')).toHaveLength(1);
});

it('폴더 이동 창과 영상 삭제 확인창', async () => {
  await idbPutRaw('settings', { key: 'folders', value: '[{"id":"f1","name":"여행"}]' });
  await idbPutRaw('videos', vid({ id: 'a', title: '공항 영상' }));
  ui();
  await settle();
  fireEvent.click(screen.getByTitle('폴더 이동'));
  expect(screen.getByText('폴더로 이동')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '미분류' })).toHaveClass('cur');
  fireEvent.click(screen.getByRole('button', { name: '📁 여행' }));
  await settle();
  expect(screen.queryByText('폴더로 이동')).toBeNull();
  expect(screen.getByText('📁 여행')).toBeInTheDocument();

  fireEvent.click(screen.getByTitle('영상 삭제'));
  await settle();
  expect(screen.getByText('“공항 영상” 영상과 이 영상에서 담은 단어가 함께 삭제돼요.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  await settle();
  expect(screen.getByText('아직 영상이 없어요. 위에서 YouTube 영상을 추가해보세요.')).toBeInTheDocument();
});
```

Run: `npx vitest run src/features/learn/LearnScreen` → FAIL

- [ ] **Step 2: `src/features/learn/views.tsx`**

```tsx
import { useState, type MouseEvent } from 'react';
import { toast } from '../../ui/store';
import { fmt, groupByFolder, learnVocab, resumeList, thumb, type VFilter, type Video, type VocabItem } from './model';
import { useLearnStore } from './store';

const SOON = '이 기능은 다음 단계에서 옮겨요';

function ResumeRow() {
  const videos = useLearnStore(s => s.videos);
  const openVideo = useLearnStore(s => s.openVideo);
  const removeResume = useLearnStore(s => s.removeResume);
  const list = resumeList(videos);
  return (
    <div id="resumeRow" style={{ display: list.length ? undefined : 'none' }}>
      {list.length > 0 && (
        <>
          <div className="resume-sec-t">이어보기</div>
          <div className="resume-row">
            {list.map(v => (
              <div key={v.id} className="rcard" onClick={() => openVideo(v.id)}>
                <div className="rthumb" style={{ backgroundImage: `url(${thumb(v.youtubeId)})` }}>
                  <button className="rx" title="이어보기에서 제거" onClick={e => { e.stopPropagation(); void removeResume(v.id); }}>✕</button>
                  <span className="rplay">▶</span>
                </div>
                <div className="rt">{v.title || '제목 없음'}</div>
                <div className="rtime">이어보기 {fmt(v.resume!.time)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function VideoCard({ v }: { v: Video }) {
  const nv = useLearnStore(s => s.vocab.filter(x => x.videoId === v.id).length);
  const { openVideo, openFolderPicker, deleteVideo } = useLearnStore.getState();
  return (
    <div className="vid-card" onClick={() => openVideo(v.id)}>
      <div className="vid-thumb" style={{ backgroundImage: `url(${thumb(v.youtubeId)})` }}><div className="pl">▶</div></div>
      <div className="vid-meta"><div className="t">{v.title || '제목 없음'}</div><div className="s">자막 {v.lines?.length || 0}줄 · 단어 {nv}개</div></div>
      <button className="vdel" title="폴더 이동" onClick={e => { e.stopPropagation(); openFolderPicker(v.id); }}>🗂</button>
      <button className="vdel" title="영상 삭제" onClick={e => { e.stopPropagation(); void deleteVideo(v.id); }}>✕</button>
    </div>
  );
}

function LibraryList() {
  const videos = useLearnStore(s => s.videos);
  const folders = useLearnStore(s => s.folders);
  const { renameFolder, deleteFolder } = useLearnStore.getState();
  if(!videos.length) return <div className="empty">아직 영상이 없어요. 위에서 YouTube 영상을 추가해보세요.</div>;
  return (
    <>
      {groupByFolder(videos, folders).map(g => g.folder ? (
        <div key={g.folder.id}>
          <div className="folder-head">
            <span className="fn">📁 {g.folder.name}</span>
            <button className="fa" title="이름 변경" style={{ marginLeft: 'auto' }} onClick={() => renameFolder(g.folder!.id)}>✎</button>
            <button className="fa" title="폴더 삭제" onClick={() => deleteFolder(g.folder!.id)}>✕</button>
          </div>
          {g.videos.length
            ? g.videos.map(v => <VideoCard key={v.id} v={v} />)
            : <div style={{ fontSize: 12, color: 'var(--ink-faint)', padding: '0 16px 8px' }}>비어 있음 (🗂로 영상 이동)</div>}
        </div>
      ) : g.videos.length > 0 && (
        <div key="__none__">
          {folders.length > 0 && <div className="folder-head"><span className="fn" style={{ color: 'var(--ink-soft)' }}>미분류</span></div>}
          {g.videos.map(v => <VideoCard key={v.id} v={v} />)}
        </div>
      ))}
    </>
  );
}

const TAGS: Array<[VFilter, string]> = [['all', '전체'], ['word', '단어'], ['idiom', '관용구'], ['slang', '슬랭']];
const TYPE_LABEL: Record<string, string> = { word: '단어', idiom: '관용구', slang: '슬랭', grammar: '문법' };

/** legacy vcardEl (학습 탭 목록이라 캡처 단어는 오지 않는다) */
function VocabCard({ v }: { v: VocabItem }) {
  const vt = useLearnStore(s => s.videos.find(x => x.id === v.videoId));
  const { openVideo, delVocab } = useLearnStore.getState();
  const tcls = v.type in TYPE_LABEL ? v.type : 'word';
  const exN = v.examples?.length ?? 0;
  const vtitle = vt ? (vt.title || '제목 없음') : '(삭제된 영상)';
  return (
    <div className="vcard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <span className="term vterm" style={{ cursor: 'pointer' }} onClick={() => toast(SOON)}>
          {v.term} {exN
            ? <span style={{ fontSize: 10, color: 'var(--teal-deep)' }}>✎{exN}</span>
            : <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>›</span>}
        </span>
        <span className={'tag ' + tcls}>{TYPE_LABEL[tcls]}</span>
      </div>
      <div className="note" onClick={() => toast(SOON)}>{v.note || '뜻 추가하려면 탭'}</div>
      {v.context && <div style={{ fontSize: 11, color: '#6E839D', marginTop: 5, lineHeight: 1.45 }}>예문: {v.context}</div>}
      <div className="vsrc" title={vtitle} onClick={() => { if(vt) void openVideo(vt.id); }}>🎬 {vtitle}</div>
      <div className="vmeta">
        {v.time != null
          ? <span className="jump" onClick={() => toast(SOON)}>{fmt(v.time)} 보기</span>
          : <span style={{ color: '#bbb', fontSize: 11 }}>시간 없음</span>}
        <span className="del" onClick={() => void delVocab(v.id)}>삭제</span>
      </div>
    </div>
  );
}

function WordsView() {
  const vocab = useLearnStore(s => s.vocab);
  const vfilter = useLearnStore(s => s.vfilter);
  const setFilter = useLearnStore(s => s.setFilter);
  const list = learnVocab(vocab, vfilter);
  return (
    <div id="learnWords">
      <div className="filterbar" id="learnVfilter">
        {TAGS.map(([k, l]) => <span key={k} className={'chip' + (vfilter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</span>)}
      </div>
      <div className="vgrid" id="learnVgrid">{list.map(v => <VocabCard key={v.id} v={v} />)}</div>
      {!list.length && <div className="empty" id="learnVEmpty">아직 영상에서 담은 단어가 없어요. 자막에서 단어를 탭해 담아보세요.</div>}
    </div>
  );
}

export function LibraryView() {
  const seg = useLearnStore(s => s.seg);
  const { setSeg, openAdd, createFolder } = useLearnStore.getState();
  return (
    <>
      <div className="topbar">
        <div className="grow"><div className="eyebrow">Study</div><h1 className="serif">내 영상</h1></div>
        <button className="chip teal" onClick={openAdd}>＋ 영상</button>
        <button className="chip teal" onClick={() => void createFolder()}>＋ 폴더</button>
      </div>
      <div className="seg2" id="learnSeg">
        <span className={seg === 'videos' ? 'on' : undefined} data-v="videos" onClick={() => setSeg('videos')}>영상</span>
        <span className={seg === 'words' ? 'on' : undefined} data-v="words" onClick={() => setSeg('words')}>단어</span>
      </div>
      {seg === 'videos'
        ? <div id="learnVideos"><ResumeRow /><div id="libList"><LibraryList /></div></div>
        : <WordsView />}
    </>
  );
}

/** 4c 에서 플레이어·자막으로 바꾼다 */
export function StudyPlaceholder() {
  const current = useLearnStore(s => s.current);
  const { backToLibrary, renameVideo } = useLearnStore.getState();
  if(!current) return null;
  return (
    <>
      <div className="topbar">
        <button className="iconbtn" onClick={() => void backToLibrary()}>‹</button>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="serif" id="studyTitle" onClick={() => void renameVideo()} title="탭해서 제목 수정"
            style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>
            {current.title}
          </div>
          <div id="studySub" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>자막 {current.lines?.length || 0}줄</div>
        </div>
      </div>
      <div className="empty">학습 화면(플레이어·자막)은 다음 단계에서 옮겨요.</div>
    </>
  );
}

const closeOnBackdrop = (close: () => void) => (e: MouseEvent) => { if(e.target === e.currentTarget) close(); };

export function AddVideoModal() {
  const { closeAdd, addVideo } = useLearnStore.getState();
  const [url, setUrl] = useState('');
  return (
    <div className="modal-bg show" id="addVidModal" onClick={closeOnBackdrop(closeAdd)}>
      <div className="modal">
        <h3>＋ 영상 추가</h3>
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 10px', lineHeight: 1.55 }}>
          YouTube 주소나 영상 ID를 넣으세요. 제목은 자동으로 가져와요. (학습 화면에서 제목 탭하면 수정)
        </p>
        <input type="text" id="newVidUrl" placeholder="https://youtu.be/… 또는 영상 ID" value={url} autoFocus onChange={e => setUrl(e.target.value)} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="ghost sm" onClick={closeAdd}>닫기</button>
          <button className="secondary grow" id="addVidBtn" onClick={() => void addVideo(url)}>영상 만들기</button>
        </div>
      </div>
    </div>
  );
}

export function FolderPickerModal() {
  const movingVideoId = useLearnStore(s => s.movingVideoId);
  const videos = useLearnStore(s => s.videos);
  const folders = useLearnStore(s => s.folders);
  const { moveToFolder, closeFolderPicker, newFolderThenMove } = useLearnStore.getState();
  const cur = videos.find(x => x.id === movingVideoId)?.folderId ?? null;
  return (
    <div className="modal-bg show" id="folderModal" onClick={closeOnBackdrop(closeFolderPicker)}>
      <div className="modal">
        <h3>폴더로 이동</h3>
        <div id="folderList" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className={'pick-btn' + (!cur ? ' cur' : '')} onClick={() => void moveToFolder(null)}>미분류</button>
          {folders.map(f => (
            <button key={f.id} className={'pick-btn' + (cur === f.id ? ' cur' : '')} onClick={() => void moveToFolder(f.id)}>📁 {f.name}</button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="ghost grow" onClick={() => void newFolderThenMove()}>＋ 새 폴더</button>
          <button className="ghost" onClick={closeFolderPicker}>닫기</button>
        </div>
      </div>
    </div>
  );
}
```


- [ ] **Step 3: `src/features/learn/LearnScreen.tsx`**

```tsx
import { useEffect } from 'react';
import { useLearnStore } from './store';
import { AddVideoModal, FolderPickerModal, LibraryView, StudyPlaceholder } from './views';

// legacy screen-library / screen-study 와 학습 탭 모달
export function LearnScreen() {
  const screenName = useLearnStore(s => s.screen.name);
  const addOpen = useLearnStore(s => s.addOpen);
  const picking = useLearnStore(s => s.movingVideoId !== null);
  const loadAll = useLearnStore(s => s.loadAll);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { window.scrollTo(0, 0); }, [screenName]);

  return (
    <>
      {screenName === 'study' ? <StudyPlaceholder /> : <LibraryView />}
      {addOpen && <AddVideoModal />}
      {picking && <FolderPickerModal />}
    </>
  );
}
```

- [ ] **Step 4: 학습 탭에 연결** — `src/app/screens.tsx`

import를 추가하고 `learn` 줄을 바꾼다.

```tsx
import { LearnScreen } from '../features/learn/LearnScreen';
```

```tsx
  learn: { id: 'screen-library', inMain: true, render: () => <LearnScreen /> },
```

- [ ] **Step 5: 확인 후 커밋**

Run: `npx vitest run src/features/learn` → 22 passed (model 8 + store 9 + screen 5). 5번 반복해 흔들리지 않는지 확인.
Run: `npm test` → 179 passed. `npx tsc --noEmit` → 출력 없음. `npm run build` → 에러 없음.

```bash
git add src/features/learn src/app/screens.tsx
git commit -m "feat(learn): 학습 탭 목록 화면 이관 (영상·폴더·이어보기·단어 목록·추가/이동/삭제)"
```

---

### Task 5: legacy와 나란히 비교 확인

- [ ] **Step 1: 두 앱 띄우기** — 새 앱 `npm run dev`(5173), legacy `python -m http.server 8124 -d legacy`(8124).

- [ ] **Step 2: 같은 데이터 넣기** — 두 곳 DevTools 콘솔에서 IndexedDB `tabloEnglishLab`에 같은 기록을 넣는다(영상 2~3개: 폴더 지정/미지정, `resume` 있는 것 하나, 자막 줄 몇 개; 단어 2~3개: word/idiom, `time` 있는 것/없는 것; `settings.folders` JSON 문자열). 새로고침 후 학습 탭.

- [ ] **Step 3: 확인 항목** (모바일 375px)
1. 목록: 제목줄(＋ 영상·＋ 폴더), 영상/단어 전환, 이어보기 줄(썸네일·✕·이어보기 시간), 폴더 머리(✎·✕), 빈 폴더 안내, 미분류 머리, 영상 카드(썸네일·제목·"자막 N줄 · 단어 N개"·🗂·✕)가 같은 모양.
2. 단어 보기: 필터 칩 4개, 단어 카드(✎N 또는 ›, 종류 태그 색, 뜻/안내, 예문, 🎬 영상 제목 또는 삭제된 영상, m:ss 보기 또는 시간 없음, 삭제).
3. 영상 추가(실제 YouTube 주소로 제목 자동), 폴더 만들기·이름 바꾸기·삭제, 폴더 이동과 빈 폴더 자동 정리, 영상 삭제 확인창, 단어 삭제 확인창, 토스트.
4. **기록 형식:** 새 앱에서 영상 추가·폴더 이동을 한 뒤 IndexedDB의 `videos` 기록과 `settings.folders`를 legacy 쪽에 그대로 넣으면 legacy가 같은 목록을 보여 준다.

- [ ] **Step 4: 푸시** — `git push`
