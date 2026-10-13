import { useAppStore } from '../store/app';
import { TABS } from './tabs';

// legacy CSS(#tabbar .tab, .active, .ico, .lab)를 그대로 쓰려고 같은 마크업을 유지한다.
export function TabBar() {
  const tab = useAppStore(s => s.tab);
  const setTab = useAppStore(s => s.setTab);
  return (
    <nav id="tabbar">
      {TABS.map(t => (
        <div
          key={t.id}
          className={'tab' + (t.id === tab ? ' active' : '')}
          data-s={t.id}
          role="button"
          tabIndex={0}
          aria-current={t.id === tab ? 'page' : undefined}
          onClick={() => setTab(t.id)}
          onKeyDown={e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); setTab(t.id); } }}
        >
          <div className="ico">{t.icon}</div>
          <div className="lab">{t.label}</div>
        </div>
      ))}
    </nav>
  );
}
