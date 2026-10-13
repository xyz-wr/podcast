import { beforeEach, expect, it } from 'vitest';
import { GTM_ID, loadGtm, shouldLoadGtm, trackTabView } from './gtm';

beforeEach(() => {
  window.dataLayer = [];
  document.head.querySelectorAll('script[src*="googletagmanager"]').forEach(s => s.remove());
});

it('실제 사이트에서만 GTM 을 켠다', () => {
  expect(shouldLoadGtm('production')).toBe(true);
  expect(shouldLoadGtm('branch-deploy')).toBe(false);
  expect(shouldLoadGtm('deploy-preview')).toBe(false);
  expect(shouldLoadGtm('dev')).toBe(false);
});

it('미리보기에서는 스크립트를 넣지 않는다', () => {
  expect(loadGtm('branch-deploy')).toBe(false);
  expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
});

it('실제 사이트에서는 컨테이너 스크립트를 넣는다', () => {
  expect(loadGtm('production')).toBe(true);
  expect(document.querySelector<HTMLScriptElement>('script[src*="googletagmanager"]')?.src)
    .toBe(`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`);
  expect(window.dataLayer?.[0]).toMatchObject({ event: 'gtm.js' });
});

it('탭 가상 페이지뷰 (기존 커밋과 같은 형식)', () => {
  trackTabView('voca');
  expect(window.dataLayer).toContainEqual({ event: 'virtual_pageview', page_path: '/voca', page_title: '보카' });
});
