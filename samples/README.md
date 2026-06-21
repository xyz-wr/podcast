# 자막 정렬 규칙 (EN ⇄ KO)

추후 업로드되는 한국어·영어 자막은 **이 규칙**을 따르면 앱이 자동으로 1:1 정렬한다.

## 핵심 규칙
앱은 영어 `.srt`와 한국어 `.srt`를 **각각** 받아 **타임스탬프로 짝**짓는다
(`koInRange` / `nearest` in `index.html`). 따라서:

> **같은 대사의 EN 큐와 KO 큐는 시작 타임스탬프를 동일하게 맞춘다.**
> (번호·시간이 줄마다 1:1로 대응 → 흔들림 없이 정렬됨)

## 파일 네이밍 (영상별 폴더)
영상마다 `samples/<영상id>/` 폴더 하나에 모아둔다. 공용 파일(`README.md`,
`align_srt.py`)만 `samples/` 루트에 둔다.
```
samples/
  <영상id>/
    build_<영상id>.py   ← 빌드 스크립트 (아래 3개 파일을 생성)
    <영상id>.en.srt     ← 영어(학습 기준)
    <영상id>.ko.srt     ← 한국어(뜻 확인용)
    <영상id>.json       ← 둘을 합친 정렬쌍(코드/검수용, 선택)
```

## 주의 (자동 YouTube 자막의 함정)
- 자동 자막은 영어가 줄바꿈으로 끊겨, **같은 줄의 한국어가 1~2줄 앞선 영어의 번역**인 경우가 많다.
  → 영어를 한 덩어리로 이어 붙인 뒤 **문장 단위로 한국어와 의미 정렬**하고, 그 문장의
     첫 단어가 등장하는 시각을 그 쌍의 시작 시간으로 잡는다.
- 음성 인식 오류는 정렬 시 교정한다. (예: `it's adinga` → `it's Ariannita la Gringa`,
  `when I saw problem` → `when I solve a problem`)
- `[Music]`, `0:11 11초` 같은 라벨/노이즈는 제거한다.

## SRT 한 큐 형식
```
7
00:00:22,000 --> 00:00:30,000
I work downtown at Divisions Maintenance Group ...
```
- 시간 형식: `HH:MM:SS,mmm`
- EN/KO 파일에서 **같은 번호 = 같은 시간 = 같은 대사**

## 예시 파일
- `ariannita-cincinnati/ariannita-cincinnati.en.srt`
- `ariannita-cincinnati/ariannita-cincinnati.ko.srt`
- `ariannita-cincinnati/ariannita-cincinnati.json`

## 사용 방법
학습 화면 **✎** → 영어칸에 `*.en.srt`, 한국어칸에 `*.ko.srt` 업로드.
