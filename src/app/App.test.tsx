import { beforeEach, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { initialTab, useAppStore } from '../store/app';

function start(saved?: string) {
  if(saved !== undefined) localStorage.setItem('elab_tab', saved);
  useAppStore.setState({ tab: initialTab() });
  render(<App />);
}

beforeEach(() => { localStorage.clear(); window.dataLayer = []; });

it('탭 6개를 기존 순서대로 그린다', () => {
  start();
  expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['🔤보카', '💬회화', '🎯퀴즈', '▶학습', '🎥영상', '⚙더보기']);
});

it('저장된 탭이 없으면 퀴즈 탭', () => {
  start();
  expect(screen.getByRole('button', { name: /퀴즈/ })).toHaveClass('active');
});

it('elab_tab 에 저장된 탭을 연다', () => {
  start('voca');
  expect(screen.getByRole('button', { name: /보카/ })).toHaveClass('active');
});

it('알 수 없는 값이면 퀴즈 탭', () => {
  start('garbage');
  expect(screen.getByRole('button', { name: /퀴즈/ })).toHaveClass('active');
});

it('탭을 누르면 elab_tab 저장, 가상 페이지뷰, 화면 전환', () => {
  start();
  fireEvent.click(screen.getByRole('button', { name: /영상/ }));
  expect(localStorage.getItem('elab_tab')).toBe('video');
  expect(window.dataLayer).toContainEqual({ event: 'virtual_pageview', page_path: '/video', page_title: '영상' });
  expect(screen.getByRole('button', { name: /영상/ })).toHaveClass('active');
  expect(screen.getByTestId('screen')).toHaveTextContent('영상');
});
