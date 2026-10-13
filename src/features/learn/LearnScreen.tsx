import { useEffect } from 'react';
import { useLearnStore } from './store';
import { AddVideoModal, FolderPickerModal, LibraryView, StudyPlaceholder } from './views';

// legacy screen-library / screen-study 와 학습 탭 모달
export function LearnScreen() {
  const screenName = useLearnStore(s => s.screen.name);
  const addOpen = useLearnStore(s => s.addOpen);
  const picking = useLearnStore(s => s.movingVideoId !== null);
  const loadAll = useLearnStore(s => s.loadAll);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { window.scrollTo(0, 0); }, [screenName]);

  return (
    <>
      {screenName === 'study' ? <StudyPlaceholder /> : <LibraryView />}
      {addOpen && <AddVideoModal />}
      {picking && <FolderPickerModal />}
    </>
  );
}
