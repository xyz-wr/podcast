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
