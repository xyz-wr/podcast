import { createContext, useContext } from 'react';
import { useQuizStore, type QuizStore } from './store';

/** 퀴즈 화면이 그릴 스토어. 기본값은 퀴즈 탭의 전역 스토어, 회화의 표현 연습은 따로 만든 스토어를 넣는다. */
export const QuizStoreContext = createContext<QuizStore>(useQuizStore);
export const useQuiz = (): QuizStore => useContext(QuizStoreContext);
