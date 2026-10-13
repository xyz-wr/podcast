import { createElement, type ReactNode } from 'react';
import { exprWords, qNorm, variants } from '../../core/legacy/quiz-core.js';
import { speak } from '../../speech/tts';
import { useQuiz } from './context';
import { POOL, type Result } from './model';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** legacy highlightEn: 핵심 표현 단어(어형변화 포함)를 <mark> 로 */
export function markExpression(en: string, expression: string): ReactNode[] {
  const words: string[] = exprWords(expression);
  if(!words.length) return [en];
  const all = words.flatMap((w: string) => variants(w) as string[]).sort((a, b) => b.length - a.length).map(escapeRe);
  const re = new RegExp('\\b(' + all.join('|') + ')\\b', 'ig');
  return en.split(re).map((part, i) => (i % 2 ? createElement('mark', { key: i }, part) : part));
}

/** legacy diffHTML: 모범 답안에 없는 내 단어를 흐리게 */
export function dimExtra(text: string, extra: string[]): ReactNode[] {
  const dim = new Set(extra);
  return text.split(/(\s+)/).map((w, i) => {
    const k = qNorm(w);
    return k && dim.has(k) ? <span key={i} className="qz-dim">{w}</span> : w;
  });
}

export function SpeakButton({ text }: { text: string }) {
  return (
    <button className="qz-spk" aria-label="발음 듣기" onClick={e => { e.stopPropagation(); speak(text); }}>▶</button>
  );
}

/** legacy headHTML: 표현 모드는 뒤로 가기·표현·문장 수, 그 외는 완료 진도와 완료함 칩 */
export function Head({ sub }: { sub: string }) {
  const st = useQuiz()();
  if(st.mode === 'expr' && st.expr){
    const e = st.expr, n = Math.min(e.cursor + 1, e.queue.length);
    return (
      <div className="qz-head">
        <button className="qz-back" id="qzExprBack" aria-label="뒤로" onClick={st.exit}>‹</button>
        <div className="qz-h1">{e.title}<span>{e.sub}</span></div>
        <div className="qz-hbar"><i style={{ width: (n / e.queue.length * 100).toFixed(1) + '%' }} /></div>
        <span className="qz-hchip">문장 {n} / {e.queue.length}</span>
      </div>
    );
  }
  const done = Object.keys(st.qs.completed).length;
  const pct = POOL.length ? done / POOL.length * 100 : 0;
  return (
    <div className="qz-head">
      <div className="qz-h1">영작 퀴즈<span>{sub}</span></div>
      <div className="qz-hbar"><i style={{ width: pct.toFixed(2) + '%' }} /></div>
      <button className="qz-hchip" onClick={() => st.go('completed')}>완료 {done} / {POOL.length} ›</button>
    </div>
  );
}

export function Dots({ n, results, total }: { n: number; results: Result[]; total: number }) {
  return (
    <div className="qz-dots">
      {Array.from({ length: total }, (_, i) => {
        const r = results[i];
        const cls = r ? (r.ok ? 'ok' : 'no') : i === n ? 'now' : undefined;
        return <i key={i} className={cls} />;
      })}
    </div>
  );
}

export function Steps({ on }: { on: 1 | 2 | 3 }) {
  const c = (n: number) => (n === on ? 'on' : undefined);
  return <div className="qz-step"><i className={c(1)}>1</i>영작<i className={c(2)}>2</i>답 확인<i className={c(3)}>3</i>듣고 순서</div>;
}
