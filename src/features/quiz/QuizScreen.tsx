import { useEffect } from 'react';
import { activeRound, useQuizStore } from './store';
import { CompletedView, DoneView, ListenView, QuestionView, ResultView, SummaryView } from './views';

// legacy <div class="qz qzui" id="qzRoot"> 와 draw() 분기
export function QuizScreen() {
  const view = useQuizStore(s => s.view);
  const open = useQuizStore(s => s.open);
  const mode = useQuizStore(s => s.mode);
  const round = useQuizStore(s => activeRound(s).round);
  const cursor = useQuizStore(s => activeRound(s).cursor);

  useEffect(() => { open(); }, [open]);
  useEffect(() => { window.scrollTo(0, 0); }, [view, cursor]);

  return (
    <div className="qz qzui" id="qzRoot">
      {view === 'quiz' && <QuestionView key={`${mode}-${round}-${cursor}`} />}
      {view === 'result' && <ResultView />}
      {view === 'listen' && <ListenView />}
      {view === 'summary' && <SummaryView />}
      {view === 'done' && <DoneView />}
      {view === 'completed' && <CompletedView />}
    </div>
  );
}
