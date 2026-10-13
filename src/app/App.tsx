import { useAppStore } from '../store/app';
import { TabBar } from './TabBar';
import { tabLabel } from './tabs';

// 각 탭 화면은 Phase 2~7에서 이 자리를 실제 컴포넌트로 바꾼다.
export function App() {
  const tab = useAppStore(s => s.tab);
  return (
    <>
      <section className="screen active" data-testid="screen">
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--ink-soft)' }}>
          {tabLabel(tab)} 화면은 이관 중입니다.
        </div>
      </section>
      <TabBar />
    </>
  );
}
