# AI 학습 로드맵 — LLM·에이전트 자료 40선 상세 정리


---

## 목차
- [추천 학습 순서](#추천-학습-순서)
- [🎥 영상 (8)](#-영상-videos)
- [💻 GitHub 저장소 (10)](#-github-저장소)
- [📘 가이드 (5)](#-가이드-guides)
- [📚 책 (7)](#-책-books)
- [📄 논문 (4)](#-논문-research-papers)
- [🎓 강의 (5)](#-강의-courses)
- [한눈에 보기: 무료/유료·난이도](#한눈에-보기)

---

## 추천 학습 순서

내용을 읽어본 뒤 정리한 제안입니다.

| 단계 | 목표 | 자료 |
|---|---|---|
| 1. 개념 잡기 | LLM이 뭔지 감 잡기 | Karpathy 영상(1h) → Stanford 에이전틱 AI 웨비나(1h) |
| 2. 에이전트 설계 원칙 | "언제 에이전트를 쓰고, 어떻게 단순하게 만드나" | Anthropic 「Building effective agents」 글 + Barry Zhang 영상(15분) → OpenAI 가이드(34쪽) → Google Agents 백서(42쪽) |
| 3. 직접 만들어보기 | 루프·도구·메모리를 손으로 | Kam Lasater 영상(20분) → Hugging Face Agents Course → MCP 강의(DeepLearning.AI) |
| 4. 운영·평가 | 프로덕션에서 살아남기 | Sayash Kapoor 영상(20분) → Google Agents Companion(76쪽) → Agent Memory 강의 |
| 5. 심화 | LLM 내부와 엔지니어링 | Stanford CS229 LLM 강의 → *Build a LLM from Scratch* → *AI Engineering* / `mlabonne/llm-course` |
| 6. 뿌리 | 원조 논문 | CoT → ReAct → Toolformer → Generative Agents |

> 코딩 도구로 Claude Code를 쓴다면 [Claude Code Best Practices](#4-claude-code-best-practices)를 1단계와 병행해서 읽으면 좋습니다.

---

## 🎥 영상 (Videos)

### 1. [Intro to Large Language Models](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- **발표자**: Andrej Karpathy · **길이**: 약 60분 · 2023년 11월 (AI Security Summit 발표를 다시 녹화)
- **내용** (챕터 기준)
  - **Part 1 — LLM이란**: 추론과 학습 구조, "LLM의 꿈"(환각), 파인튜닝으로 어시스턴트 만들기, RLHF·합성 데이터
  - **Part 2 — 미래**: 스케일링 법칙, 도구 사용(브라우저·계산기·인터프리터·DALL-E), 멀티모달, System 1/2 사고, 자기개선(AlphaGo 비유), GPTs 같은 맞춤화, **"LLM OS"** 비유
  - **Part 3 — 보안**: 탈옥, 프롬프트 인젝션, 데이터 포이즈닝
  - 설명란 보충: 파인튜닝은 환각을 고치지 못하고 "도움이 되는 꿈" 쪽으로 방향을 잡아줄 뿐이다
- **대상**: LLM을 처음 개념적으로 이해하려는 입문자

### 2. [Stanford CS229 — Building Large Language Models (LLMs)](https://www.youtube.com/watch?v=9vM4p9NN0Ts)
- **발표자**: Yann Dubois (Stanford 박사과정, Alpaca 팀) · **길이**: 약 1시간 45분 · 2024년 여름 게스트 강의
- **내용**
  - ChatGPT 같은 모델을 만드는 전 과정: 사전학습(언어 모델링)과 사후학습(SFT/RLHF)
  - 각 단계를 데이터·알고리즘·평가 관점에서 설명
  - 아키텍처(Transformer)보다 **데이터·평가·시스템**이 실제로 더 중요하다는 점을 강조
  - 자기회귀 모델 정의, 토크나이제이션, perplexity, MMLU 벤치마크
  - (설명란 챕터가 24분까지만 있어 그 뒤 세부 내용은 확인하지 못함)
- **대상**: LLM 학습 파이프라인을 기술적으로 이해하려는 중급자

### 3. [Stanford Webinar — Agentic AI: A Progression of Language Model Usage](https://www.youtube.com/watch?v=kJLiOGle3Lw)
- **발표자**: Insop Song (GitHub Next) · **길이**: 약 57분
- **내용**
  - LM 학습 개요 → API 사용과 프롬프트 모범 사례
  - LM의 한계를 보완하는 RAG와 reflection
  - 도구 사용과 function calling
  - 에이전틱 LM의 정의, Reasoning + Action, 고객지원 에이전트 예시
  - 설계 패턴: reflection, planning, tool use, 반복 / Q&A
- **대상**: "LLM 사용 → 에이전트"로 넘어가는 흐름을 개념적으로 정리하고 싶은 입문~중급자

### 4. [Building and evaluating AI Agents](https://www.youtube.com/watch?v=d5EltXhbcfA)
- **발표자**: Sayash Kapoor (프린스턴, 『AI Snake Oil』 공저) · **길이**: 약 20분 · AI Engineer Summit 2025
- **내용**
  - 에이전트는 좁은 역할에서는 이미 쓸모 있지만, 거창한 주장은 검증이 필요하다
    - 사례: FTC 제재를 받은 DoNotPay, 법률 AI 환각률 약 1/6~1/3
  - 단순화된 데모, LLM 채점, 악용 가능한 보상은 실력을 부풀린다 → **실제 과제로 평가**
  - **비용과 정확도는 함께 측정**: 루프·서브에이전트 구조 때문에 비슷한 성능이어도 가격 차이가 크다
  - 단일 점수 대신 다차원 평가를 쓰고, 도메인 전문가가 평가 기준을 보완한다
  - **역량(capability) ≠ 신뢰성(reliability)** → 에이전트 개발은 "신뢰성 엔지니어링"이어야 한다
- **대상**: 에이전트를 만들거나 도입을 결정하는 사람, 과대광고를 걸러보고 싶은 사람

### 5. [How We Build Effective Agents](https://www.youtube.com/watch?v=D7_ipDqhtwk)
- **발표자**: Barry Zhang (Anthropic) · **길이**: 15분
- **내용** (Anthropic 블로그 글 「Building effective agents」의 발표판)
  - **모든 일에 에이전트를 쓰지 말 것**: 결정 트리를 그릴 수 있는 일이면 워크플로가 더 싸고 예측 가능하다. 에이전트는 모호하고 가치 큰 과제에 쓴다
    - 예: 고객지원 과제당 약 $0.10, 3만~5만 토큰 예산
  - 역량·위험·검증 가능성을 함께 평가한다. 코딩은 테스트·CI가 있어 검증하기 쉬운 영역
  - **최소 구성부터**: 환경 + 도구 + 시스템 프롬프트를 루프로 연결. 최적화는 그다음
  - 디버깅은 **에이전트의 시점에서**: 제한된 컨텍스트 안에서 프롬프트, 도구 설명, 궤적을 점검
  - 열린 문제: 예산을 의식한 실행, 스스로 진화하는 도구, 비동기 멀티에이전트
- **대상**: 에이전트 시스템을 설계하는 AI 엔지니어

### 6. [Building Agents with Model Context Protocol — Full Workshop](https://www.youtube.com/watch?v=kQmXtrmQ5Zg)
- **발표자**: Mahesh Murag (Anthropic) · **길이**: 약 1시간 44분 · AI Engineer Summit 2025 워크숍
- **챕터**
  - 00:00 MCP란: AI와 데이터 소스를 잇는 개방형 표준, 파편화된 통합을 하나로 대체
  - 09:39 MCP로 개발하기
  - 26:25 MCP와 에이전트 (가장 긴 파트)
  - 1:13:15 MCP의 다음 단계 (로드맵)
- **대상**: MCP 서버·클라이언트나 MCP 기반 에이전트를 직접 만들려는 개발자

### 7. [Let's Build An Agent from Scratch](https://www.youtube.com/watch?v=xzXdLRUyjUg)
- **발표자**: Kam Lasater · **길이**: 약 20분 · 코드: [mfdtrade/agent-talk-2025](https://github.com/mfdtrade/agent-talk-2025)
- **내용**: 프레임워크 없이 **"에이전트라 부를 수 있는 최소 구성"**(LLM + 메모리 + 계획 + 도구 + while 루프)을 단계별로 만든다
  1. 일반 Chat Completions 호출 + JSON 스키마(`done` boolean)로 답을 판정하는 critic 호출
  2. `searchGoogle`(SerpApi) 도구 추가. 모델은 호출을 "요청"만 하고 실행은 앱이 한다
  3. 여러 도구 호출을 각 호출 ID를 유지하며 처리
  4. to-do 리스트로 계획과 메모리 구현
  5. 데모: 에이전트가 "에이전트 만드는 법"을 리서치
- **대상**: 에이전트 내부 구조를 코드로 이해하고 싶은 개발자 (TypeScript 사용)

### 8. [PhiloAgents Course](https://github.com/neural-maze/philoagents-course) (GitHub 강좌)
- **제작**: The Neural Maze × Decoding ML · 무료 오픈소스 · 글(Substack) + 영상
- **목표**: 플라톤·아리스토텔레스·튜링 등 **철학자를 연기하는 NPC 에이전트**로 게임 시뮬레이션 엔진 만들기
- **모듈**
  1. 시스템 아키텍처
  2. LangGraph + agentic RAG로 에이전트 구현
  3. MongoDB로 단기/장기 메모리
  4. FastAPI + WebSockets 배포
  5. LLMOps: Opik으로 평가·프롬프트 모니터링
  6. uv, ruff, Docker
- **비용**: Groq 무료 티어 사용, 전체 실행해도 최대 약 $1
- **대상**: Python과 LLM/RAG 초급 이상, 만들면서 배우려는 엔지니어

---

## 💻 GitHub 저장소

> 원문은 11개지만 `NirDiamant/GenAI_Agents`가 1번과 5번에 중복되어 실제로는 10개입니다.

### 1. [NirDiamant/GenAI_Agents](https://github.com/NirDiamant/GenAI_Agents) — ⭐ 약 2.5만
- **무엇**: 단순 대화봇부터 멀티에이전트까지 생성형 AI 에이전트 **구현 노트북 57개** 모음
- **카테고리**: Beginner(대화, QA, while 루프 에이전트) / Framework(LangGraph, MCP) / Business(고객지원, 계약 분석, HR) / Creative(GIF, 음악) / Analysis(메모리, 멀티에이전트, 자기개선) / QA(Human-in-the-loop, 트레이스 기반 평가) / Advanced(Controllable RAG)
- **스택**: 주로 LangGraph. LangChain, PydanticAI, AutoGen, CrewAI, OpenAI Swarm 등도 사용
- **대상**: 개념을 안 뒤 다양한 예제로 패턴을 익히려는 중급자. 순서가 정해진 커리큘럼이라기보다 예제 모음

### 2. [microsoft/ai-agents-for-beginners](https://github.com/microsoft/ai-agents-for-beginners) — ⭐ 약 7.7만
- **무엇**: Microsoft의 **18개 레슨** AI 에이전트 입문 코스
- **레슨**
  1. 에이전트 소개
  2. 프레임워크
  3. 디자인 패턴
  4. Tool Use
  5. Agentic RAG
  6. 신뢰할 수 있는 에이전트
  7. Planning
  8. Multi-Agent
  9. Metacognition
  10. 프로덕션
  11. 프로토콜(MCP·A2A·NLWeb)
  12. Context Engineering
  13. 메모리
  14. Microsoft Agent Framework
  15. Computer Use
  16. 배포
  17. 로컬 에이전트
  18. 보안
- **형식**: 레슨마다 본문 + 짧은 영상 + Python 코드, 50개 이상 언어로 번역 (클론할 때는 sparse checkout 권장)
- **필요**: Azure 계정(Microsoft Foundry). 생성형 AI가 처음이면 "Generative AI For Beginners"부터 들으라고 안내
- **대상**: 처음부터 순서대로 배우려는 입문자, 특히 Microsoft 생태계 사용자

### 3. [dair-ai/Prompt-Engineering-Guide](https://github.com/dair-ai/Prompt-Engineering-Guide) — ⭐ 약 7.9만
- **무엇**: 프롬프트·컨텍스트 엔지니어링, RAG, 에이전트 가이드 모음 (웹판: promptingguide.ai)
- **구성**
  - 기법: Zero/Few-shot, CoT, Self-Consistency, Prompt Chaining, ToT, RAG, ReAct, PAL 등
  - 응용: Function Calling, 합성 데이터, 코드 생성
  - 그 외: Prompt Hub, 모델별 가이드, 위험과 오용(적대적 공격, 편향), 논문·도구·데이터셋, 1시간 강의
- **대상**: 수준 무관. 읽기 위주의 레퍼런스

### 4. [HandsOnLLM/Hands-On-Large-Language-Models](https://github.com/HandsOnLLM/Hands-On-Large-Language-Models) — ⭐ 약 3만
- **무엇**: O'Reilly 책 『Hands-On Large Language Models』(Jay Alammar·Maarten Grootendorst, 2024) 공식 코드
- **12장 (장마다 Colab 노트북)**
  1. 언어 모델 소개
  2. 토큰과 임베딩
  3. Transformer 내부
  4. 텍스트 분류
  5. 클러스터링, 토픽 모델링
  6. 프롬프트 엔지니어링
  7. 고급 텍스트 생성
  8. 시맨틱 검색, RAG
  9. 멀티모달
  10. 임베딩 모델 만들기
  11. 표현 모델 파인튜닝
  12. 생성 모델 파인튜닝
  - 보너스: Mamba, 양자화, MoE, Reasoning LLM 시각 가이드
- **대상**: 그림과 코드로 LLM 원리부터 파인튜닝까지 이해하려는 입문~중급자 (Colab 무료 T4로 실행 가능)

### 5. [GokuMohandas/Made-With-ML](https://github.com/GokuMohandas/Made-With-ML) — ⭐ 약 5만
- **무엇**: ML 앱을 설계→개발→배포→반복 개선하는 **MLOps 코스** (본문은 madewithml.com)
- **흐름**: 학습 → 튜닝 → 실험 추적 → 평가 → 추론 → 서빙 → 테스트(코드·데이터·모델) → CI/CD → 지속 학습
- **스택**: Python, Ray, MLflow, pytest, GitHub Actions, Anyscale
- **대상**: 모델을 실서비스 수준으로 올리는 엔지니어링을 배우려는 사람. LLM 전용 자료는 아님

### 6. [Sumanth077/Hands-On-AI-Engineering](https://github.com/Sumanth077/Hands-On-AI-Engineering) — ⭐ 약 4천
- **무엇**: 실전 AI 프로젝트 큐레이션
  - AI Agents 약 45개: 리서치, 금융 분석, SQL, PR 리뷰, 브라우저 자동화 등
  - RAG 11개, OCR 4개, Audio 4개, Multimodal 6개, Fine-tuning 1개
- **스택**: 프로젝트마다 다름 (LangGraph, CrewAI, Agno, smolagents, Mem0, MCP, Streamlit 등)
- **대상**: 기초를 마친 뒤 포트폴리오 아이디어나 레퍼런스 코드를 찾는 사람

### 7. [aishwaryanr/awesome-generative-ai-guide](https://github.com/aishwaryanr/awesome-generative-ai-guide) — ⭐ 약 3만
- **무엇**: 생성형 AI 학습 허브
- **구성**
  - 3가지 Journey(Use / Build / Understand AI) × 101·201·301 레벨
  - 무료 코스 90여 개 목록
  - 무료 자체 코스: AI Evals for Everyone, Agentic AI Crash Course, Applied LLMs Mastery 등
  - **역할별 면접 준비**(AI Engineer, AI PM, FDE 등, 공통 질문 60개)
  - 월간 논문, 용어집
- **대상**: 학습 경로를 고르려는 사람, AI 직무 면접 준비생

### 8. [chiphuyen/dmls-book](https://github.com/chiphuyen/dmls-book) — ⭐ 약 5천
- **무엇**: Chip Huyen 『Designing Machine Learning Systems』(O'Reilly, 2022)의 요약과 참고자료. **코드 없음**
- **장 구성**
  1. ML 시스템 개요
  2. 설계 입문
  3. 데이터 엔지니어링
  4. 학습 데이터
  5. 피처 엔지니어링
  6. 모델 개발·평가
  7. 배포
  8. 분포 변화·모니터링
  9. 지속 학습
  10. MLOps 인프라
  11. 인적 측면
- **참고**: 한국어판(한빛미디어)이 있음
- **대상**: ML을 실서비스로 설계·운영하는 의사결정을 배우려는 엔지니어와 매니저

### 9. [microsoft/ML-For-Beginners](https://github.com/microsoft/ML-For-Beginners) — ⭐ 약 9만
- **무엇**: **고전 머신러닝** 12주·26레슨 커리큘럼 (딥러닝과 LLM은 다루지 않음)
- **구성**: 회귀(호박 가격) → 웹앱 → 분류(요리) → 클러스터링(나이지리아 음악) → NLP → 시계열(ARIMA) → 강화학습(Q-Learning)
  - 레슨마다 퀴즈, 과제, 스케치노트
- **스택**: Python과 Scikit-learn (일부 레슨은 R)
- **대상**: ML을 처음 배우는 학생, 교재가 필요한 교사

### 10. [mlabonne/llm-course](https://github.com/mlabonne/llm-course) — ⭐ 약 8.4만
- **무엇**: 로드맵 + Colab 노트북 LLM 코스 (저자는 『LLM Engineer's Handbook』 공저자)
- **3트랙**
  - **Fundamentals**(선택): 수학, Python, 신경망, NLP
  - **LLM Scientist**: 아키텍처, 사전학습, SFT, 선호 정렬, 평가, 양자화
  - **LLM Engineer**: LLM 실행, 벡터 DB, RAG, 에이전트, 추론 최적화, 배포, 보안
- **노트북**: Unsloth, DPO, QLoRA, GGUF, MergeKit 등 실습
- **대상**: 파인튜닝·양자화를 직접 해보려는 중급 이상

---

## 📘 가이드 (Guides)

> 이 섹션이 이 목록에서 가장 핵심입니다. 다섯 개 모두 무료입니다.

### 1. [Google — Agents 백서](https://www.kaggle.com/whitepaper-agents)
- **저자**: Julia Wiesinger, Patrick Marlow, Vladimir Vuskovic (Google) · 2025년 2월판 · 42쪽
- **핵심**
  - **에이전트란**: 목표를 위해 세계를 관찰하고, 도구로 행동하며, 지시 없이도 다음 행동을 스스로 추론하는 애플리케이션
  - **3요소**
    - **Model**: 의사결정자. ReAct·CoT·ToT 같은 추론 프레임워크를 따름
    - **Tools**: 외부 세계와의 연결 (주로 웹 API)
    - **Orchestration layer**: 정보 수용 → 추론 → 행동을 목표에 이를 때까지 반복
  - **모델 vs 에이전트**: 지식(학습 데이터 한정 vs 도구로 확장), 상태(단발 vs 멀티턴), 도구(없음 vs 내장), 논리 계층(없음 vs 인지 아키텍처)
  - **ReAct 루프**: Question → Thought → Action → Observation을 반복한 뒤 Final answer
  - **도구 3종**
    - **Extensions**: 에이전트 측에서 API 직접 호출 (예: Google Flights, Code Interpreter)
    - **Functions**: 모델은 함수 이름과 인자(JSON)만 출력하고, 실행은 **클라이언트 측**에서. 보안·인증 제약, 실행 순서 제약, 후처리가 필요할 때 적합
    - **Data Stores**: 벡터 DB 기반 RAG. 재학습 없이 PDF·웹사이트 등을 연결
  - **도구 선택 성능 높이기**: in-context learning / retrieval-based in-context learning / fine-tuning을 셰프 비유로 설명하고 조합을 권장
  - 실습: LangGraph `create_react_agent` + 검색·장소 도구. 프로덕션용으로 Vertex AI Agent Builder 소개
  - 전망: 전문 에이전트를 엮는 "mixture of agent experts"

### 2. [Google — Agents Companion](https://www.kaggle.com/whitepaper-agent-companion)
- **저자**: Antonio Gulli 외 10명 · 2025년 2월 · 76쪽 · 위 백서의 "102 심화편"
- **핵심**
  - **AgentOps**: DevOps → MLOps → GenAIOps 위에 놓이는 운영 체계. 도구 관리, 프롬프트(goal/profile/instructions), 메모리, 과제 분해를 다룸
  - **성공 지표**: 북극성 비즈니스 지표 → 목표 달성률 → 지연·오류 텔레메트리 → 👍👎 피드백 → OpenTelemetry trace
  - **평가 3축**: ① 역량(벤치마크: BFCL, τ-bench, PlanBench, AgentBench) ② **궤적과 도구 사용** ③ **최종 응답**. ②와 ③부터 시작 권장
  - **궤적 평가 지표 6종**: exact match, in-order match, any-order match, precision, recall, single-tool use
  - 최종 응답은 **LLM-as-a-judge**로 평가하고, 사람 평가로 judge를 보정("evaluating the evaluator")
  - **멀티에이전트**
    - 역할: Planner / Retriever / Execution / Evaluator
    - 패턴: Sequential / Hierarchical / Collaborative / Competitive
    - 구성요소: 메모리, Tool RAG, Agent-to-Agent 통신, Agent & Tool 레지스트리
  - **Agentic RAG**: 쿼리 확장, 멀티스텝, 소스 선택, 검증. 단, **에이전트를 붙이기 전에 검색 품질부터** 높이라고 권함 (시맨틱 청킹, 메타데이터, 리랭커, grounding check)
  - **엔터프라이즈**: Assistant형과 Automation형 에이전트. 지식노동자는 "에이전트의 관리자"가 된다는 전망. Google Agentspace, NotebookLM Enterprise 소개
  - **Agents → Contractors**: 고위험 작업은 계약(과제, 산출물 검증 사양, 범위, 비용, 기간) + 협상 + 하위 계약으로 정의. 사례: Google AI co-scientist
  - **자동차 AI 사례**: Hierarchical / Diamond / Peer-to-Peer / Response Mixer / Adaptive Loop 패턴. 긴급 기능은 온디바이스에서 처리
  - 결론 메시지: "도메인 지식을 외주 주지 말라"

### 3. [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- **저자**: Erik Schluntz, Barry Zhang · 2024-12-19 · 블로그 글 한 편
- **핵심**
  - **워크플로 vs 에이전트**: 워크플로는 미리 정한 코드 경로, 에이전트는 LLM이 과정과 도구 사용을 스스로 결정
  - **가장 단순한 해법부터**: 많은 경우 검색과 예시를 곁들인 단일 LLM 호출로 충분하다. 에이전트는 지연과 비용을 성능과 맞바꾸는 선택
  - **프레임워크 주의**: 추상화가 프롬프트를 가려 디버깅을 어렵게 한다 → API 직접 사용부터 시작
  - **기본 블록 "Augmented LLM"**: LLM + 검색 + 도구 + 메모리 (MCP 권장)
  - **워크플로 패턴 5가지**

    | 패턴 | 설명 | 예시 |
    |---|---|---|
    | Prompt chaining | 고정 단계 + 단계 사이 검증 gate | 문구 작성 → 번역 |
    | Routing | 입력 분류 후 전문 처리 | 쉬운 질문은 Haiku, 어려운 질문은 Sonnet |
    | Parallelization | sectioning / voting | 가드레일 분리, 다중 코드 리뷰 |
    | Orchestrator-workers | 중앙 LLM이 동적으로 분해·위임 | 여러 파일 코딩 변경 |
    | Evaluator-optimizer | 생성 ↔ 평가 반복 | 문학 번역 |

  - **에이전트**: "환경 피드백을 받으며 루프 안에서 도구를 쓰는 LLM". 매 단계 ground truth 확인, 최대 반복 횟수, 샌드박스 테스트 필요
  - **3대 원칙**: 단순성 · 투명성(계획을 드러내기) · **ACI(agent-computer interface) 설계**
  - **부록 — 도구 프롬프트 엔지니어링**
    - 모델이 생각할 토큰 여유 주기
    - 인터넷에 흔한 포맷 쓰기
    - 줄 수 세기·이스케이프 부담 없애기
    - 포카요케(예: 절대경로 강제)
    - SWE-bench 작업 때 프롬프트보다 **도구 설계에 더 많은 시간**을 들였다고 밝힘

### 4. [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
- **주체**: Anthropic 공식 문서 · 약 4~5천 단어
- **핵심**
  - **근본 제약은 컨텍스트 윈도우**: 차오를수록 성능이 떨어지므로 가장 중요한 자원으로 관리
  - **가장 중요한 팁 — 스스로 검증할 수단 주기**: 테스트, 빌드, 린터, 스크린샷. 성공은 주장이 아니라 증거로
  - **4단계**: Explore → Plan(Plan mode, Shift+Tab) → Implement → Commit. 한 문장으로 설명되는 작은 작업은 계획 생략
  - **구체적 프롬프트**: 범위, 출처, 기존 패턴, 증상과 "고쳐진 상태"를 명시. `@파일`, 이미지, `cat log | claude -p` 활용
  - **CLAUDE.md**: `/init`으로 초안을 만들고 **짧게** 유지. 각 줄마다 "지우면 실수가 생기나?"를 따짐. 코드로 알 수 있는 것은 넣지 않음
  - **환경 설정**: permissions, sandbox, auto mode, CLI 도구(가장 컨텍스트 효율적), MCP, hooks(반드시 실행돼야 할 일), skills, 서브에이전트, 플러그인
  - **큰 기능**: Claude가 사용자를 인터뷰하게 해서 SPEC.md를 쓰고, 새 세션에서 구현
  - **세션 관리**: Esc로 중단, `/rewind`, 관련 없는 작업 사이에는 `/clear`. **같은 교정을 두 번 넘게 했다면 새로 시작**. 조사는 서브에이전트에 위임
  - **확장**: `claude -p` 비대화형 실행, worktree 병렬, Writer/Reviewer 세션 분리, fan-out(2~3개로 먼저 시험)
  - **흔한 실패 5가지**: 잡탕 세션, 반복 교정, 비대한 CLAUDE.md, 검증 없는 신뢰, 끝없는 탐색

### 5. [OpenAI — A Practical Guide to Building Agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) (PDF)
- **발행**: OpenAI · 2025년 4월 · 34쪽
- **핵심**
  - **정의**: 사용자를 대신해 독립적으로 작업을 완수하는 시스템. LLM이 실행을 관리하고 실패하면 사람에게 넘기며, 가드레일 안에서 도구를 고른다. 단순 챗봇은 에이전트가 아님
  - **언제 만들까**: 복잡한 판단(환불 승인), 유지보수가 어려운 규칙(벤더 보안 리뷰), 비정형 데이터(보험 청구). 비유: 규칙 엔진은 체크리스트, 에이전트는 노련한 조사관
  - **3요소**: Model / Tools / Instructions
  - **모델 선택**: 가장 강력한 모델로 eval 기준선을 세운 뒤, 작은 모델로 바꿔가며 비용과 지연을 줄임
  - **도구 3유형**: Data(조회) / Action(실행) / Orchestration(다른 에이전트를 도구로). API 없는 레거시 시스템은 computer-use로
  - **지시문**: 기존 SOP와 정책 문서를 활용, 작은 단계로 분해, 엣지 케이스는 분기로 처리
  - **오케스트레이션**: 단일 에이전트 역량을 먼저 최대화. 멀티에이전트로 나눌 신호는 ① 분기 로직 과다 ② **도구 간 유사·중복**(개수 자체보다 겹침이 문제)
  - **멀티에이전트 2패턴**: Manager(에이전트를 도구로 호출) / Decentralized(handoff로 제어권 이전)
  - **가드레일(계층 방어)**: relevance·safety 분류기, PII 필터, moderation, 도구 위험 등급(저/중/고), 규칙 기반, 출력 검증. 실제 실패 사례를 보며 추가
  - **사람 개입**: 실패 임계치 초과, 고위험 행동(취소, 큰 환불, 결제) 시
  - 결론: "작게 시작하고, 실제 사용자로 검증하고, 점진적으로 확장하라"

---

## 📚 책 (Books)

### 1. [Understanding Deep Learning](https://udlbook.github.io/udlbook/) — 🆓 PDF 무료
- **저자**: Simon J.D. Prince · MIT Press, 2023
- **함께 제공**: 장별 그림, Jupyter 노트북, 학생용 정답 일부
- **21장**
  - 기초 (1~9장): 지도학습 → 얕은/깊은 신경망 → 손실 → 학습 → 초기화 → 성능 측정 → 정규화
  - 아키텍처 (10~13장): CNN → ResNet → **Transformer** → GNN
  - 생성·강화학습 (14~19장): 비지도 → GAN → Normalizing Flow → VAE → **Diffusion** → 심층 강화학습
  - 마무리 (20~21장): 딥러닝은 왜 작동하나 → 윤리
- **대상**: 딥러닝 이론을 제대로 잡고 싶은 사람

### 2. [Build a Large Language Model (From Scratch)](https://www.manning.com/books/build-a-large-language-model-from-scratch)
- **저자**: Sebastian Raschka · Manning, 2024년 9월 · 368쪽
- **가격**: eBook $54.99 (확인 시점 40% 할인 $32.99). liveBook에서 온라인 열람 가능
- **장**
  1. LLM 이해
  2. 텍스트 데이터
  3. **어텐션 구현**
  4. GPT 모델 구현
  5. 사전학습
  6. 분류 파인튜닝
  7. 지시 따르기 파인튜닝
  - 부록: PyTorch, LoRA
- **배우는 것**: 라이브러리 없이 GPT-2급 모델을 직접 코딩. 일반 노트북에서도 실행 가능 (GPU 선택)
- **대상**: 중급 Python과 ML 기초가 있는 사람

### 3. [LLM Engineer's Handbook](https://www.oreilly.com/library/view/llm-engineers-handbook/9781836200079/) *(Wayback 2025-12-08)*
- **저자**: Paul Iusztin, Maxime Labonne · Packt, 2024년 10월 · 522쪽 · 중급~고급
- **장**
  1. LLM Twin 개념
  2. 도구 설치
  3. 데이터 엔지니어링
  4. RAG 피처 파이프라인
  5. SFT
  6. 선호 정렬
  7. 평가
  8. 추론 최적화
  9. RAG 추론 파이프라인
  10. 배포
  11. MLOps/LLMOps
- **배우는 것**: "LLM Twin" 제품 하나를 FTI(feature/training/inference) 파이프라인으로 끝까지 구축 (ZenML, Qdrant, SageMaker, LoRA/DPO, 양자화)

### 4. [AI Agents: The Definitive Guide](https://www.oreilly.com/library/view/ai-agents-the/0642572247775/) *(Wayback 2026-06-21)*
- **저자**: Nicole Koenigstein · O'Reilly, 2026년 9월 · 354쪽 · 중급~고급
- **장**
  1. LLM에서 에이전트로
  2. 아키텍처와 패턴
  3. 고급 계획·추론
  4. 모델 최적화
  5. 프로토타입에서 프로덕션
  6. 보안 실행·도구 거버넌스
  7. 제품 배포
  8. 기본 평가·관측
  9. 고급 평가
  10. 메모리
  11. 비용 효율 설계
  12. **위협 모델링**
- **배우는 것**: Reflexion·ReAct·LangGraph 기반 설계, Ray/Kubernetes 확장, 샌드박싱. 과장 마케팅을 "agent-washing"이라 비판

### 5. [Building Applications with AI Agents](https://www.oreilly.com/library/view/building-applications-with/9781098176495/) *(Wayback 2026-05-31)*
- **저자**: Michael Albada · O'Reilly, 2025년 9월 · 354쪽 · **입문~중급**
- **장**
  1. 에이전트 소개
  2. 시스템 설계
  3. **에이전트 UX 설계**
  4. 도구 사용
  5. 오케스트레이션
  6. 지식·메모리
  7. 학습
  8. 멀티에이전트
  9. 검증·측정
  10. 모니터링
  11. 개선 루프
  12. 보안
  13. 인간-에이전트 협업
- **특징**: 이 목록의 에이전트 책 중 유일하게 입문~중급 대상이고, UX와 협업까지 다룸

### 6. [AI Agents with MCP](https://www.oreilly.com/library/view/ai-agents-with/9798341639546/) *(Wayback 2026-05-30)*
- **저자**: Kyle Stratis · O'Reilly, 2026년 8월 · 275쪽 · 중급~고급
- **장** (저장본 시점에는 얼리 릴리스, 목차 미확정)
  1. Agentic AI와 MCP
  2. MCP 소개
  3. MCP 클라이언트
  4. 클라이언트 심화
  5. MCP 서버(도구·프롬프트·리소스)
  6. 서버 심화
  7. 테스트·보안·공유
- **배우는 것**: Python으로 MCP 서버, 클라이언트, 전송 계층을 직접 구현

### 7. [AI Engineering](https://www.oreilly.com/library/view/ai-engineering/9781098166298/) *(Wayback 2026-06-20)*
- **저자**: Chip Huyen · O'Reilly, 2024년 12월 · 534쪽 · 중급~고급
- **장**
  1. 파운데이션 모델로 앱 만들기
  2. 파운데이션 모델 이해
  3. 평가 방법론
  4. AI 시스템 평가
  5. 프롬프트 엔지니어링
  6. RAG와 에이전트
  7. 파인튜닝
  8. 데이터셋 엔지니어링
  9. 추론 최적화
  10. 아키텍처와 사용자 피드백
- **배우는 것**: 기존 ML 엔지니어링과 AI 엔지니어링의 차이, AI-as-a-judge 평가, 모델 적응 기법 비교, 지연·비용 병목 해결
- **참고**: 같은 저자의 *Designing ML Systems*(GitHub 8번)와 보완 관계

> 3~7번은 O'Reilly 구독이나 개별 구매가 필요합니다. 페이지에 가격은 표시되지 않습니다.

---

## 📄 논문 (Research Papers)

### 1. [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)
- Yao et al. (Princeton·Google) · 2022 · ICLR
- **문제**: 추론(CoT)과 행동(계획 생성)이 따로 연구되어 왔다
- **방법**: 추론 흔적과 행동을 **번갈아** 생성한다. 추론은 계획을 세우고 수정하며, 행동은 Wikipedia API 같은 외부에서 정보를 가져온다
- **결과**
  - HotpotQA·Fever에서 CoT의 환각과 오류 전파를 줄임
  - ALFWorld·WebShop에서 모방학습·강화학습 대비 성공률 **+34%p / +10%p** (예시 1~2개만 사용)
  - 사람이 해석하고 신뢰하기 쉬움
- **의의**: 오늘날 에이전트 루프(Thought → Action → Observation)의 원형

### 2. [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442)
- Park et al. (Stanford·Google) · 2023
- **방법**: 경험을 자연어로 저장(메모리) → 상위 수준 **성찰(reflection)**로 종합 → 필요할 때 검색해서 계획
- **실험**: 심즈 풍 마을에 에이전트 25명
- **결과**: "밸런타인 파티를 열고 싶다"는 설정 하나로 이틀 동안 에이전트들이 스스로 초대를 퍼뜨리고, 데이트 신청을 하고, 제시간에 모였다
- **어블레이션**: 관찰·계획·성찰이 각각 행동의 그럴듯함에 결정적

### 3. [Toolformer: Language Models Can Teach Themselves to Use Tools](https://arxiv.org/abs/2302.04761)
- Schick et al. (Meta) · 2023
- **문제**: LM은 강력하지만 산술이나 사실 조회는 작은 모델보다도 못하다
- **방법**: 어떤 API를 언제, 어떤 인자로 호출하고 결과를 어떻게 쓸지를 **자기지도 학습**. API마다 시연 예시 몇 개면 충분
- **도구**: 계산기, Q&A, 검색엔진 2종, 번역, 캘린더
- **결과**: zero-shot 성능이 크게 올라 훨씬 큰 모델과 견줄 만하며, 언어 모델링 능력도 유지

### 4. [Chain-of-Thought Prompting Elicits Reasoning in LLMs](https://arxiv.org/pdf/2201.11903)
- Wei et al. (Google) · 2022
- **방법**: 프롬프트에 **중간 추론 단계가 담긴 예시**를 몇 개 넣는다
- **관찰**: 이 능력은 충분히 큰 모델에서 **창발(emerge)**한다
- **결과**: 산술·상식·기호 추론이 모두 향상. 540B 모델에 예시 8개만으로 GSM8K SOTA (파인튜닝한 GPT-3 + 검증기보다 높음)

---

## 🎓 강의 (Courses)

### 1. [Hugging Face AI Agents Course](https://huggingface.co/learn/agents-course) — 🆓 무료 + 수료증
- **분량**: 유닛당 1주, 주 3~4시간 · 수준: 입문~전문가
- **유닛**
  - **Unit 0**: 온보딩
  - **Unit 1**: 에이전트·LLM·특수 토큰·도구·Thought-Action-Observation·ReAct → smolagents로 첫 에이전트
  - **Unit 2**: 프레임워크 3종 — **smolagents**(코드 에이전트, 멀티에이전트, 비전/브라우저), **LlamaIndex**, **LangGraph**
  - **Unit 3**: Agentic RAG 실전 (Gala 에이전트)
  - **Unit 4**: 최종 프로젝트 — **GAIA 벤치마크** 도전
  - **보너스**: 함수 호출 파인튜닝 / 관측·평가 / 포켓몬 배틀 에이전트
- **수료증**: Fundamentals(Unit 1 완료), Completion(+과제 + 최종 챌린지). 마감 없음
- **선수**: 기초 Python, 기초 LLM 지식

### 2. [MCP: Build Rich-Context AI Apps with Anthropic](https://www.deeplearning.ai/short-courses/mcp-build-rich-context-ai-apps-with-anthropic/) — 🆓 (베타 기간)
- **강사**: Elie Schoppik (Anthropic) · 약 2시간 · 영상 11개 · 중급
- **레슨**: Why MCP → 아키텍처 → 챗봇 예제 → **MCP 서버 만들기** → **MCP 클라이언트 만들기** → 레퍼런스 서버 연결 → 프롬프트·리소스 기능 → Claude Desktop 설정 → **원격 서버 배포**
- **선수**: Python, LLM 앱 기초

### 3. [Building Applications with Vector Databases](https://www.deeplearning.ai/short-courses/building-applications-vector-databases/) — 🆓 (베타 기간)
- **강사**: Tim Tully (Pinecone) · 약 1.5시간 · 입문
- **배우는 것**: Pinecone으로 벡터 DB 응용 6가지 구현 — 시맨틱 검색, RAG, 추천 시스템, 하이브리드 검색, 얼굴 유사도 검색, 이상 탐지
- **선수**: 입문 수준 Python, ML 기초

### 4. [Vector Databases: from Embeddings to Applications](https://www.deeplearning.ai/short-courses/vector-databases-embeddings-applications/) — 🆓 (퀴즈는 PRO)
- **강사**: Sebastian Witalec (Weaviate) · 약 1시간 · 중급
- **레슨**: 벡터 표현 얻기 → 유사 벡터 검색 → **근사 최근접 이웃(ANN)** → 벡터 DB → 희소·밀집·하이브리드 검색 → 다국어 검색
- **3번과의 차이**: 3번이 "응용" 중심이라면 이 강의는 **원리** 중심

### 5. [Agent Memory: Building Memory-Aware Agents](https://www.deeplearning.ai/short-courses/agent-memory-building-memory-aware-agents/) — 🆓 (수료증은 PRO)
- **강사**: Richmond Alake, Nacho Martínez (Oracle) · 약 2시간 · 중급
- **레슨**: 에이전트에 왜 메모리가 필요한가 → **메모리 매니저 만들기** → 시맨틱 도구 메모리로 도구 검색 확장 → 메모리 추출·통합·자동 갱신 → 메모리를 쓰는 에이전트 완성 → Spec.md로 로컬 프로젝트
- **선수**: Python, LLM 기초

---

## 한눈에 보기

| 분류 | 자료 | 무료 | 난이도 | 분량 |
|---|---|:-:|---|---|
| 영상 | Karpathy Intro to LLMs | ✅ | 입문 | 1h |
| 영상 | Stanford CS229 LLM | ✅ | 중급 | 1h45m |
| 영상 | Stanford Agentic AI | ✅ | 입문~중급 | 57m |
| 영상 | Kapoor 평가 | ✅ | 중급 | 20m |
| 영상 | Barry Zhang 효과적인 에이전트 | ✅ | 중급 | 15m |
| 영상 | MCP 워크숍 | ✅ | 중급 | 1h44m |
| 영상 | Agent from Scratch | ✅ | 중급 | 20m |
| 강좌 | PhiloAgents | ✅ (API 약 $1) | 초급~중급 | 6모듈 |
| GitHub | GenAI_Agents | ✅ | 중급 | 노트북 57개 |
| GitHub | MS ai-agents-for-beginners | ✅ (Azure 필요) | 입문 | 18레슨 |
| GitHub | Prompt-Engineering-Guide | ✅ | 전체 | 레퍼런스 |
| GitHub | Hands-On LLMs | ✅ (책은 유료) | 입문~중급 | 12장 |
| GitHub | Made-With-ML | ✅ | 중급 | MLOps 전 과정 |
| GitHub | Hands-On-AI-Engineering | ✅ | 중급 | 프로젝트 70여 개 |
| GitHub | awesome-generative-ai-guide | ✅ | 전체 | 허브 |
| GitHub | dmls-book | ✅ (책은 유료) | 중급 | 요약 |
| GitHub | ML-For-Beginners | ✅ | 입문 | 26레슨 |
| GitHub | llm-course | ✅ | 중급+ | 3트랙 |
| 가이드 | Google Agents | ✅ | 입문~중급 | 42쪽 |
| 가이드 | Google Agents Companion | ✅ | 중급+ | 76쪽 |
| 가이드 | Anthropic Effective Agents | ✅ | 전체 | 글 1편 |
| 가이드 | Claude Code Best Practices | ✅ | 전체 | 문서 1편 |
| 가이드 | OpenAI 에이전트 가이드 | ✅ | 입문~중급 | 34쪽 |
| 책 | Understanding Deep Learning | ✅ PDF | 중급 | 21장 |
| 책 | Build a LLM from Scratch | 💰 (온라인 열람) | 중급 | 368쪽 |
| 책 | LLM Engineer's Handbook | 💰 | 중급~고급 | 522쪽 |
| 책 | AI Agents: Definitive Guide | 💰 | 중급~고급 | 354쪽 |
| 책 | Building Apps with AI Agents | 💰 | 입문~중급 | 354쪽 |
| 책 | AI Agents with MCP | 💰 | 중급~고급 | 275쪽 |
| 책 | AI Engineering | 💰 | 중급~고급 | 534쪽 |
| 논문 | ReAct / Generative Agents / Toolformer / CoT | ✅ | 중급 | 각 1편 |
| 강의 | HF Agents Course | ✅ + 수료증 | 입문~ | 4유닛+보너스 |
| 강의 | MCP with Anthropic | ✅ | 중급 | 2h |
| 강의 | Vector DB (Pinecone) | ✅ | 입문 | 1.5h |
| 강의 | Vector DB (Weaviate) | ✅ | 중급 | 1h |
| 강의 | Agent Memory | ✅ | 중급 | 2h |

### 확인하지 못한 부분
- YouTube 영상은 자막 전문이 아니라 설명란·챕터·공식 토크 페이지로 정리했습니다. 2번 Stanford 강의는 24분 이후 챕터가 없습니다.
- O'Reilly 5권은 현재 사이트가 막혀 있어 Wayback 저장본(2025-12 ~ 2026-06) 기준입니다. *AI Agents with MCP* 목차는 당시 미확정이었습니다.
- *Understanding Deep Learning*의 쪽수는 확인하지 못했습니다(MIT Press 페이지 접근 차단).
