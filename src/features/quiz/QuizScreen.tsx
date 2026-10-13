import { useEffect } from 'react';
import { useQuiz } from './context';
import { activeRound } from './store';
import { CompletedView, DoneView, ExprDoneView, ListenView, QuestionView, ResultView, SummaryView } from './views';

/** legacy draw() 분기. context 의 스토어(퀴즈 탭 또는 표현 연습)를 그린다. */
export function QuizBody() {
  const useStore = useQuiz();
  const view = useStore(s => s.view);
  const open = useStore(s => s.open);
  const mode = useStore(s => s.mode);
  const round = useStore(s => activeRound(s).round);
  const cursor = useStore(s => activeRound(s).cursor);

  useEffect(() => { open(); }, [open]);
  useEffect(() => { window.scrollTo(0, 0); }, [view, cursor]);

  return (
    <>
      {view === 'quiz' && <QuestionView key={`${mode}-${round}-${cursor}`} />}
      {view === 'result' && <ResultView />}
      {view === 'listen' && <ListenView />}
      {view === 'summary' && <SummaryView />}
      {view === 'done' && <DoneView />}
      {view === 'exprDone' && <ExprDoneView />}
      {view === 'completed' && <CompletedView />}
    </>
  );
}

// legacy <div class="qz qzui" id="qzRoot">. context 기본값이 퀴즈 탭 스토어다.
export function QuizScreen() {
  return <div className="qz qzui" id="qzRoot"><QuizBody /></div>;
}
