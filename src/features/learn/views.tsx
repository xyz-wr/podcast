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
  const adding = useLearnStore(s => s.adding);
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
          <button className="secondary grow" id="addVidBtn" disabled={adding} onClick={() => void addVideo(url)}>영상 만들기</button>
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
