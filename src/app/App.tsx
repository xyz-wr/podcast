import { useAppStore } from '../store/app';
import { SCREENS } from './screens';
import { TabBar } from './TabBar';
import { DialogHost } from '../ui/DialogHost';
import { tabLabel } from './tabs';

export function App() {
  const tab = useAppStore(s => s.tab);
  const def = SCREENS[tab];
  const section = (
    <section id={def.id} className="screen active" data-testid="screen">
      {def.render ? def.render() : (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--ink-soft)' }}>
          {tabLabel(tab)} 화면은 이관 중입니다.
        </div>
      )}
    </section>
  );
  // legacy 는 <main> 을 항상 두고, 퀴즈·영상 화면만 그 바깥에 둔다.
  return (
    <>
      <main>{def.inMain && section}</main>
      {!def.inMain && section}
      <TabBar />
      <DialogHost />
    </>
  );
}
