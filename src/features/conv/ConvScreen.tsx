import { useEffect } from 'react';
import { useConvStore } from './store';
import { CardView, CatView, FolderView, HomeView, MarksView } from './views';

// legacy <div class="cv-toast" id="convToast"> + <div class="conv" id="convRoot"> 와 draw() 분기
export function ConvScreen() {
  const view = useConvStore(s => s.view);
  const toast = useConvStore(s => s.toast);
  const hideToast = useConvStore(s => s.hideToast);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);
  useEffect(() => {
    if(!toast.show) return;
    const t = setTimeout(hideToast, 1800);
    return () => clearTimeout(t);
  }, [toast.n, toast.show, hideToast]);

  return (
    <>
      <div className={'cv-toast' + (toast.show ? ' show' : '')} id="convToast">{toast.msg}</div>
      <div className="conv" id="convRoot">
        {view.name === 'home' && <HomeView />}
        {view.name === 'cat' && <CatView cid={view.cid} />}
        {view.name === 'marks' && <MarksView />}
        {view.name === 'folder' && <FolderView fid={view.fid} />}
        {view.name === 'card' && <CardView key={`${view.fid}#${view.idx}`} fid={view.fid} idx={view.idx} />}
      </div>
    </>
  );
}
