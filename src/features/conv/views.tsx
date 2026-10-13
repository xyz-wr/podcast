import { createElement, useState, type ReactNode } from 'react';
import { QuizStoreContext } from '../quiz/context';
import { QuizBody } from '../quiz/QuizScreen';
import { createQuizStore, exprQuizState } from '../quiz/store';
import { CATS, FEMOJI, FOLDERS, TOTAL_CARDS, catById, catFolders, catOf, fById, searchFolders, type Folder } from './data';
import { folderDone, isDone, isMark, useConvStore } from './store';

/** legacy 는 <sm> 태그를 쓰고 CSS 가 그것을 꾸민다 */
const Sm = ({ children }: { children: ReactNode }) => createElement('sm', null, children);

/** legacy ring() */
export function Ring({ pct, size, sw, color }: { pct: number; size: number; sw: number; color: string }) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100), h = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={h} cy={h} r={r} fill="none" stroke="var(--cv-line)" strokeWidth={sw} />
      <circle cx={h} cy={h} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform={`rotate(-90 ${h} ${h})`} />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="ringtxt"
        style={{ fontSize: (size * 0.27).toFixed(0) + 'px' }}>{Math.round(pct)}%</text>
    </svg>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  const nav = useConvStore(s => s.nav);
  return (
    <div className="cv-head">
      <button className="cv-back" onClick={() => nav({ name: 'home' })}>‹</button>
      <div className="cv-htitle">{title}<span>{sub}</span></div>
    </div>
  );
}

function FolderTile({ f }: { f: Folder }) {
  const progress = useConvStore(s => s.progress);
  const nav = useConvStore(s => s.nav);
  const d = folderDone(progress, f), pct = f.cards.length ? d / f.cards.length * 100 : 0, full = d === f.cards.length;
  const c = catOf(f.id);
  return (
    <button className={'ftile' + (full ? ' done' : '')} onClick={() => nav({ name: 'folder', fid: f.id })}>
      <span className="fimg" style={{ background: `linear-gradient(145deg,${c.g[0]},${c.g[1]})` }}>
        <span className="fe">{FEMOJI[f.id] || '💬'}</span>
        {full && <span className="fdone">✓</span>}
      </span>
      <span className="ftitle">{f.titleKo}</span>
      <span className="fbar"><i style={{ width: pct + '%' }} /></span>
      <span className="fprog">{full ? '완료!' : `${d} / ${f.cards.length}`}</span>
    </button>
  );
}

export function HomeView() {
  const { progress, searchQ, setSearch, nav, resetProgress, showToast } = useConvStore();
  const done = Object.keys(progress.done).length;
  const pct = TOTAL_CARDS ? done / TOTAL_CARDS * 100 : 0;
  const doneFolders = FOLDERS.filter(f => folderDone(progress, f) === f.cards.length).length;
  const found = searchQ ? searchFolders(searchQ) : null;
  const reset = () => {
    if(!window.confirm('모든 회화 학습 완료·북마크 기록을 지울까요?')) return;
    resetProgress();
    showToast('학습 기록을 초기화했어요');
  };
  return (
    <>
      <div className="cv-hero"><h1 className="serif">오늘의 회화 연습</h1><p>주제를 고르고, 한국어를 영어로 말해 보세요.</p></div>
      <div className="psum">
        <div><Ring pct={pct} size={70} sw={8} color="var(--cv-teal)" /></div>
        <div className="ptxt">
          <div className="pbig">{done}<small> / {TOTAL_CARDS} 표현 완료</small></div>
          <div className="plabel">전체 학습 진도</div>
          <div className="pmeta"><Sm>완료한 주제 <b>{doneFolders}</b> / {FOLDERS.length}</Sm><Sm>남은 표현 <b>{TOTAL_CARDS - done}</b></Sm></div>
        </div>
      </div>
      <div className="homechips">
        <button className="cv-chip star" id="convBm" onClick={() => nav({ name: 'marks' })}>★ 북마크 {Object.keys(progress.marks).length}</button>
        <span className="cv-chip dim">✓ 완료 {done}</span>
      </div>
      <div className="searchwrap">
        <i>⌕</i>
        <input id="convSearch" type="search" placeholder="주제나 표현 검색 (예: 샤워, shower)" value={searchQ} onChange={e => setSearch(e.target.value)} />
      </div>
      {found ? (
        <>
          <div className="sectlabel">검색 결과 {found.length}개</div>
          {found.length
            ? <div className="fgrid">{found.map(f => <FolderTile key={f.id} f={f} />)}</div>
            : <div className="cv-empty">검색 결과가 없어요.</div>}
        </>
      ) : CATS.map(c => {
        const fs = catFolders(c);
        if(!fs.length) return null;
        return (
          <div key={c.id} className="cv-sec">
            <div className="cv-sechead">
              <b><span className="ce">{c.emoji}</span>{c.name}</b>
              <button className="cv-more" onClick={() => nav({ name: 'cat', cid: c.id })}>모두 보기</button>
            </div>
            <div className="cv-row">{fs.map(f => <FolderTile key={f.id} f={f} />)}</div>
          </div>
        );
      })}
      <div className="cv-foot"><button id="convReset" onClick={reset}>학습 기록 초기화</button></div>
    </>
  );
}

export function CatView({ cid }: { cid: string }) {
  const progress = useConvStore(s => s.progress);
  const c = catById(cid);
  if(!c) return null;
  const fs = catFolders(c);
  const d = fs.reduce((a, f) => a + folderDone(progress, f), 0), t = fs.reduce((a, f) => a + f.cards.length, 0);
  return (
    <>
      <Head title={`${c.emoji} ${c.name}`} sub={`주제 ${c.f.length}개 · 표현 ${d} / ${t} 완료`} />
      <div className="fgrid">{fs.map(f => <FolderTile key={f.id} f={f} />)}</div>
    </>
  );
}

function ExprRow({ f, i, showFolder }: { f: Folder; i: number; showFolder?: boolean }) {
  const { progress, toggleDone, toggleMark, nav } = useConvStore();
  const c = f.cards[i], on = isDone(progress, f.id, i), mk = isMark(progress, f.id, i);
  return (
    <div className="erow">
      <button className={'echeck' + (on ? ' on' : '')} aria-label="완료 표시" onClick={e => { e.stopPropagation(); toggleDone(f.id, i); }}>{on ? '✓' : ''}</button>
      <div className="ebody" onClick={() => nav({ name: 'card', fid: f.id, idx: i })}>
        {showFolder && <div className="mfolder">{f.titleKo}</div>}
        <div className="eexp">{c.expression}</div>
        <div className="emean">{c.meaningKo}</div>
      </div>
      <button className={'estar' + (mk ? ' on' : '')} aria-label="북마크" onClick={e => { e.stopPropagation(); toggleMark(f.id, i); }}>{mk ? '★' : '☆'}</button>
      <div className="echev">›</div>
    </div>
  );
}

export function MarksView() {
  const progress = useConvStore(s => s.progress);
  const items: Array<{ f: Folder; i: number }> = [];
  FOLDERS.forEach(f => f.cards.forEach((_, i) => { if(isMark(progress, f.id, i)) items.push({ f, i }); }));
  return (
    <>
      <Head title="북마크한 표현" sub={`${Object.keys(progress.marks).length}개`} />
      {items.length ? (
        <>
          <div className="sectlabel">북마크 {items.length}개</div>
          {items.map(o => <ExprRow key={`${o.f.id}#${o.i}`} f={o.f} i={o.i} showFolder />)}
        </>
      ) : (
        <div className="cv-empty"><span className="big">★</span>북마크한 표현이 아직 없어요.<br />표현 상세 화면에서 ★ 버튼을 눌러 저장하세요.</div>
      )}
    </>
  );
}

export function FolderView({ fid }: { fid: string }) {
  const progress = useConvStore(s => s.progress);
  const f = fById(fid);
  if(!f) return null;
  const d = folderDone(progress, f), pct = f.cards.length ? d / f.cards.length * 100 : 0;
  return (
    <>
      <Head title={f.titleKo} sub={`${d} / ${f.cards.length} 완료`} />
      <div className="fhead">
        <h2 className="serif">{f.titleKo}</h2>
        <div className="fh-meta">표현 {f.cards.length}개 · 표현별 A2·B1·B2 시제 연습</div>
        <div className="fbar"><i style={{ width: pct + '%' }} /></div>
        <div className="fh-prog"><span><b>{d}</b> / {f.cards.length} 완료</span><span>{Math.round(pct)}%</span></div>
      </div>
      <div className="sectlabel">표현 목록</div>
      {f.cards.map((_, i) => <ExprRow key={i} f={f} i={i} />)}
    </>
  );
}

/** legacy cardHTML + bindCard: 표현 하나를 4시제 퀴즈로. 퀴즈 탭 진도에는 반영하지 않는다. */
export function CardView({ fid, idx }: { fid: string; idx: number }) {
  const nav = useConvStore(s => s.nav);
  const showToast = useConvStore(s => s.showToast);
  const [store] = useState(() => {
    const c = fById(fid)?.cards[idx];
    const init = c ? exprQuizState(fid, idx, c.expression, c.meaningKo) : null;
    if(!init) return null;
    return createQuizStore(() => init, {
      // 완료 체크는 목록에서 직접 누르도록 둔다 (자동으로 표시하지 않음)
      onExit: (okN, total) => { nav({ name: 'folder', fid }); showToast(`${total}문장 중 ${okN}문장 정답`); },
    });
  });
  if(!store) return <div className="cv-empty">퀴즈를 불러오지 못했어요.</div>;
  return (
    <div className="qz qzui" id="cvQuizRoot">
      <QuizStoreContext.Provider value={store}><QuizBody /></QuizStoreContext.Provider>
    </div>
  );
}
