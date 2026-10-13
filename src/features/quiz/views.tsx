import { useEffect, useState } from 'react';
import { POOL, TENSE_LABEL, lookup, wrongIds } from './model';
import { Dots, Head, SpeakButton, Steps, dimExtra, markExpression } from './parts';
import { activeRound, useQuizStore } from './store';

const reviewSub = (sub: string) => (useQuizStore.getState().mode === 'review' ? '틀렸던 문장 복습' : sub);

export function QuestionView() {
  const st = useQuizStore();
  const [text, setText] = useState('');
  const a = activeRound(st);
  const it = lookup(a.queue[a.cursor] ?? '');
  if(!it) return null;
  const badge = st.mode === 'review' ? '복습' : '라운드 ' + a.round;
  const submit = () => st.submit(text);
  return (
    <>
      <Head sub={reviewSub('한국어를 영어로 써 보세요')} />
      <div className="qz-meta">
        <span className="qz-round">{badge}</span>
        <Dots n={a.cursor} total={a.queue.length} results={a.results} />
        <span className="qz-cnt">{a.cursor + 1} / {a.queue.length}</span>
      </div>
      <Steps on={1} />
      <div className="qz-lis-title">이 문장을 영어로 써 보세요</div>
      <div className="qz-card ko"><div className="qz-ko">{it.ko}</div></div>
      <textarea
        id="qzInput" className="qz-ta" rows={3} placeholder="영어로 입력하세요"
        autoCapitalize="sentences" autoComplete="off" spellCheck={false}
        value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); }}
      />
      <button className="qz-btn fill" id="qzSubmit" onClick={submit}>확인</button>
      {st.mode === 'review' && <button className="qz-btn ghost" onClick={st.endReview}>복습 그만두기</button>}
    </>
  );
}

export function ResultView() {
  const st = useQuizStore();
  const cur = st.cur;
  if(!cur) return null;
  const { it, g, ok } = cur;
  return (
    <>
      <Head sub={reviewSub('채점 결과')} />
      <Steps on={2} />
      <div className={'qz-lis-verdict ' + (ok ? 'ok' : 'no')}>
        {ok ? (cur.corrected ? '✓ 정답 처리했어요' : '✓ 정답이에요') : '✗ 다시 확인해 보세요'}
        {!ok && <small>일치율 {Math.round(g.ratio * 100)}%{g.hasExpr ? '' : ' · 핵심 표현 누락'}</small>}
      </div>
      <div className="qz-card">
        <div className="qz-lab">내 답</div>
        <div className="qz-mine">{cur.text.trim() ? dimExtra(cur.text, g.extra) : <span className="qz-dim">(입력 없음)</span>}</div>
        {g.missing.length > 0 && <div className="qz-miss">빠진 단어 · {g.missing.join(', ')}</div>}
      </div>
      <div className="qz-card ans">
        <div className="qz-lab teal">모범 답안</div>
        <div className="qz-en"><span>{markExpression(it.en, it.expression)}</span><SpeakButton text={it.en} /></div>
        <div className="qz-ko2">{it.ko}</div>
        <div className="qz-tags"><span>{it.expression}</span><span className="t">{TENSE_LABEL[it.tense]}</span><span className="t">{it.titleKo}</span></div>
        <div className="qz-mean">{it.meaningKo}</div>
      </div>
      <div className="qz-row">
        {!ok && <button className="qz-btn ghost" id="qzCorrect" onClick={st.correctMe}>사실 맞았어요</button>}
        <button className="qz-btn fill" id="qzListen" onClick={st.goListen}>듣고 순서 맞추기 ›</button>
      </div>
    </>
  );
}

export function ListenView() {
  const st = useQuizStore();
  const { cur, lis, clearBad } = st;
  // 틀린 타일은 0.42초 동안만 붉게 (legacy badT)
  useEffect(() => {
    if(!lis || lis.bad === -1) return;
    const t = setTimeout(clearBad, 420);
    return () => clearTimeout(t);
  }, [lis, clearBad]);
  if(!cur || !lis) return null;
  const it = cur.it;
  const remaining = lis.order.filter(i => !lis.picked.includes(i));
  return (
    <>
      <Head sub={reviewSub('듣고 순서 맞추기')} />
      <Steps on={3} />
      <div className="qz-lis">
        <div className="qz-lis-title">{lis.done ? <b className="ok">✓ 순서를 맞혔어요</b> : '잘 듣고 문장을 완성해 보세요'}</div>
        <div className={'qz-slot' + (lis.done ? ' done' : '')}>
          {lis.picked.length
            ? lis.picked.map(wi => <span key={wi} className="qz-tile in">{lis.words[wi]}</span>)
            : <span className="qz-ph">들리는 순서대로 단어를 탭하세요</span>}
        </div>
        {!lis.done && (
          <div className="qz-tiles">
            {remaining.map(i => (
              <button key={i} className={'qz-tile' + (lis.bad === i ? ' bad' : '')} data-pick={i} onClick={() => st.pickTile(i)}>
                {lis.words[i]}
              </button>
            ))}
          </div>
        )}
        <div className="qz-stage">
          <button className="qz-playbtn" id="qzPlay" aria-label="다시 듣기" onClick={st.sayLine}>▶</button>
          <button className="qz-rate" id="qzRate" onClick={st.cycleRate}>{st.lisRate}x</button>
        </div>
      </div>
      {lis.done && (
        <>
          <div className="qz-card ans">
            <div className="qz-lab teal">정답 문장</div>
            <div className="qz-en"><span>{markExpression(it.en, it.expression)}</span><SpeakButton text={it.en} /></div>
            <div className="qz-ko2">{it.ko}</div>
          </div>
          <button className="qz-btn fill" id="qzNext" onClick={st.next}>다음 문장 ›</button>
        </>
      )}
    </>
  );
}

export function SummaryView() {
  const st = useQuizStore();
  const a = activeRound(st);
  const okN = a.results.filter(r => r.ok).length;
  const miss = a.results.filter(r => !r.ok);
  const label = (st.mode === 'review' ? '복습 라운드 ' : '라운드 ') + a.round;
  return (
    <>
      <Head sub="라운드 결과" />
      <div className="qz-sum"><div className="n">{okN} <small>/ {a.results.length} 정답</small></div><div className="l">{label} 완료</div></div>
      {miss.length ? (
        <>
          <div className="qz-lab2">다음 라운드에 다시 나올 문장 {miss.length}개</div>
          {miss.map((r, i) => {
            const it = lookup(r.id);
            return it && <div key={i} className="qz-mrow"><div className="k">{it.ko}</div><div className="e">{it.en}</div></div>;
          })}
        </>
      ) : <div className="qz-allok">이 라운드는 전부 맞혔어요 🎉</div>}
      <button className="qz-btn fill" id="qzNextRound" onClick={st.nextRound}>다음 라운드 ›</button>
    </>
  );
}

export function DoneView() {
  const st = useQuizStore();
  if(st.mode === 'review') return (
    <>
      <Head sub="복습 완료" />
      <div className="qz-done"><div className="e">🎉</div><b>틀렸던 문장을 전부 맞혔어요</b><p>복습 기록은 완료함에 그대로 남아 있어요.</p></div>
      <button className="qz-btn fill" onClick={st.endReview}>완료함으로</button>
    </>
  );
  return (
    <>
      <Head sub="전체 완료" />
      <div className="qz-done"><div className="e">🏆</div><b>{POOL.length}문장을 모두 맞혔어요</b><p>틀렸던 문장만 다시 풀어볼 수 있어요.</p></div>
      <button className="qz-btn fill" onClick={() => st.go('completed')}>완료함 보기</button>
    </>
  );
}

export function CompletedView() {
  const st = useQuizStore();
  const ids = Object.keys(st.qs.completed).sort((x, y) => (st.qs.completed[y].wrong || 0) - (st.qs.completed[x].wrong || 0));
  const hard = wrongIds(st.qs);
  const reset = () => { if(window.confirm('퀴즈 완료 기록과 진행 중인 라운드를 모두 지울까요?')) st.resetAll(); };
  return (
    <>
      <div className="qz-head">
        <button className="qz-back" aria-label="뒤로" onClick={() => st.go('quiz')}>‹</button>
        <div className="qz-h1">완료함<span>{ids.length}문장 · 틀렸던 문장 {hard.length}개</span></div>
      </div>
      {hard.length > 0 && <button className="qz-btn fill" id="qzReview" onClick={st.startReview}>틀렸던 것만 다시 풀기 ({hard.length})</button>}
      {ids.length ? (
        <>
          <div className="qz-lab2">완료한 문장</div>
          {ids.map(id => {
            const it = lookup(id);
            if(!it) return null;
            const w = st.qs.completed[id].wrong || 0;
            return (
              <div key={id} className="qz-crow">
                <div className="b"><div className="k">{it.ko}</div><div className="e">{it.en}</div></div>
                {w > 0 && <span className="qz-wbadge">{w}회</span>}
                <SpeakButton text={it.en} />
              </div>
            );
          })}
        </>
      ) : <div className="qz-empty">아직 완료한 문장이 없어요.</div>}
      <div className="qz-footer"><button id="qzReset" onClick={reset}>퀴즈 기록 초기화</button></div>
    </>
  );
}
