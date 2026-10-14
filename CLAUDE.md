# CLAUDE.md

## 제품
- Logic Pro 12.4로 신스웨이브와 신스팝을 만들고 싶은 입문자(나)가 "이런 소리는 뭘로 내?" 하고 물으면, 애플 공식 설명서에 적힌 내용을 근거로 알맞은 악기·MIDI FX·이펙트를 출처와 함께 안내하는 챗봇.
- 지금의 불편: Logic에 어떤 악기와 이펙트가 있고 각각 뭘 하는지 몰라서, 설명서를 일일이 뒤져야 함.
- 다루는 항목은 10개.
  - 악기 5개: Retro Synth, ES2, Alchemy, EVP88, Drum Machine Designer
  - MIDI FX 1개: Arpeggiator
  - 이펙트 4개: Chorus, Rotor Cabinet, Space Designer, ChromaVerb
- 1단계: 질문과 비슷한 설명서 내용을 찾아서 보여 줌.
- 2단계: 찾은 내용을 질문과 함께 LLM에 넣어서, 문서에 근거한 답을 받음.

## 비목표
- 웹 화면, 서버, 배포는 안 함.
- "이걸 쓰면 신스웨이브가 된다" 같은 장르별 추천은 안 함. 문서에 적힌 기능과 소리 특성만 안내함.
- 노브 수치(예: Cutoff 40%) 안내는 안 함.
- 작곡·편곡·믹싱 조언은 안 함.
- Logic 외의 다른 프로그램, 위 10개 항목 외의 플러그인은 다루지 않음.

## 환경
- 내 PC(Windows)에서만 실행.
- Node.js로 만들고 PowerShell에서 실행.
- LLM은 Ollama의 qwen3.5:2b.

## 작업 규칙
- 내가 요청한 것만 만들기.
- 플러그인 이름, 메뉴 경로, URL을 지어내지 않기. 확인하지 못한 것은 [검증 필요]로 표시하기.
- 공식 문서를 통째로 복사하지 말고 요약 + 출처 URL로 쓰기.
- 문서에 없는 사용처나 사용법은 말하지 않고 "문서에 없다"고 답하기.
- 만든 뒤 직접 실행해 보고 결과를 같이 보여 주기.

## 데이터 계약
- 청크 원본은 `data/chunks.json`, 배열이고 각 항목은 `{ id, text, url, section }`.
- `id`는 LP-001부터 연속, 한 번 붙인 id의 뜻은 바꾸지 않는다.
- `text`는 최소 120자, 사실 하나. 설명서를 통째로 복사하지 않고 내 말로 요약하되, 원문에 없는 말을 보태지 않는다. 장르별 추천 문장("신스웨이브에 좋다" 등)은 넣지 않는다.
- `url`은 확인 가능한 공식 설명서 주소(퍼센트 인코딩). 직접 열어 보지 못했으면 `section` 앞에 `[검증 필요]`를 붙인다.
- `section`은 "항목명 - 주제" 형식(예: "Retro Synth - 개요").
- 자료는 Logic Pro 12.3 설명서 기준이다(12.4 설명서는 없다). LP-007만 10.6.2판 영어 페이지를 출처로 한다.

## 임베딩 계약
- 모델은 `onnx-community/embeddinggemma-300m-ONNX`, transformers.js로 `pipeline("feature-extraction", MODEL, { dtype: "q8" })`. 호출 옵션은 `{ pooling: "mean", normalize: true }`, 출력은 768차원.
- 입력 형식
  - 문서: `"title: " + section + " | text: " + text`
  - 질문: `"task: search result | query: " + question`
- `src/embedder.mjs` 한 곳에서만 정의한다. 파이프라인은 한 번만 만들어 재사용한다.
  - export: `embedDocument(chunk)`, `embedQuery(question)`, `MODEL`, `DTYPE`, `DIM`
- 벡터 저장소는 `data/vectors.json`, 형식은 `{ model, dtype, dim, createdAt, chunks: [{ id, text, url, section, vector }] }`.
- 저장소의 `model`·`dtype`이 현재 embedder의 `MODEL`·`DTYPE`과 다르면 검색을 거부하고 "build-index를 다시 실행하라"고 안내한다.

## 검색 계약
- 벡터는 정규화되어 있으므로 코사인 유사도 = 내적. 점수 내림차순으로 top-k를 돌려주고, 기본 k는 3.
- 약한 근거 기준 `WEAK_THRESHOLD = 0.55`는 `src/search.mjs`에서만 정의·export하고, 다른 파일은 import해서 쓴다.
  - 1위 점수가 이보다 낮으면 "관련 자료가 약함"으로 표시한다. 결과는 버리지 않는다.
- `src/search.mjs`는 다른 파일이 `search()`를 import해도 CLI가 실행되지 않게, 직접 실행됐을 때만 CLI를 돈다(`import.meta.url === pathToFileURL(process.argv[1]).href` 확인).

## 결정 필요
- LLM에게 줄 규칙(시스템 프롬프트)은? 답변 형식과 출처 표기 방식은?
- 1단계와 2단계의 실행 방법(명령어, 입출력 형태)은?
