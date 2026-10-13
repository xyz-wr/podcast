import { tabLabel, type TabId } from '../app/tabs';

export const GTM_ID = 'GTM-T3Q8WB9J';

declare global { interface Window { dataLayer?: Record<string, unknown>[] } }
const dataLayer = () => (window.dataLayer ||= []);

/** 미리보기·로컬 방문이 GA 에 쌓이지 않도록 Netlify CONTEXT 가 production 일 때만 켠다. */
export function shouldLoadGtm(context: string = __DEPLOY_CONTEXT__): boolean {
  return context === 'production';
}

export function loadGtm(context?: string): boolean {
  if(!shouldLoadGtm(context)) return false;
  dataLayer().push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(s);
  return true;
}

/** 탭 = 가상 페이지. GTM 의 맞춤 이벤트 트리거 virtual_pageview 가 GA4 page_view 로 보낸다. */
export function trackTabView(tab: TabId): void {
  dataLayer().push({ event: 'virtual_pageview', page_path: '/' + tab, page_title: tabLabel(tab) });
}
