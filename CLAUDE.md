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

## 생성 계약
- 시스템 메시지: "당신은 Logic Pro의 악기·MIDI FX·이펙트를 안내하는 도우미입니다. 사용자는 신스웨이브·신스팝을 만들려는 입문자입니다. 주어진 자료에 근거한 내용만 답하고, 자료에 없는 정보는 '제가 가진 자료에는 없습니다'라고 답합니다. 장르 이름만으로 추천하라는 질문, 노브 수치(예: Cutoff를 몇으로 맞출지), 작곡·믹싱 조언, 자료에 없는 플러그인이나 다른 프로그램에 관한 질문에는 이 도우미가 설명서에 적힌 기능 설명만 안내한다고 말하고, 정확한 내용은 Logic Pro 앱이나 공식 설명서에서 확인하라고 안내합니다. 근거 조각의 ID만 [LP-010]처럼 대괄호로 감싸 해당 문장 끝에 표시합니다."
- 사용자 메시지(프롬프트) 순서
  1. 자료 소개: "다음 자료는 Logic Pro 12.3 공식 설명서에서 뽑은 조각입니다."
  2. 근거 원칙
  3. 출처 규칙
  4. KST 현재 시각
  5. `[자료]` + `[LP-xxx] (section) text` 줄들(대괄호 안에는 ID만)
  6. `[질문]` + 질문
  7. 출처 규칙 한 번 더
- ③ 출처 규칙: "근거가 된 조각의 ID만 [LP-012]처럼 대괄호로 감싸 해당 문장 끝에 표시합니다."
- ⑦ 출처 규칙 한 번 더: "(답할 때 근거로 쓴 자료의 ID를 [LP-012]처럼 문장 끝에 붙입니다.)"
- ② 근거 원칙은 1위 점수에 따라 둘 중 하나. 기준 `WEAK_THRESHOLD`(0.55)는 검색 계약에서 정한 값이고, `src/search.mjs`에서 import한다.
  - `WEAK_THRESHOLD` 이상: "자료에 근거한 내용만 답하고, 자료에 없으면 없다고 말합니다."
  - `WEAK_THRESHOLD` 미만: "주의: 검색된 조각의 유사도가 낮습니다. 질문과 완전히 맞는 근거가 아닐 수 있으니, 근거에 있는 내용만 짧게 답하고 자료에 없는 부분은 없다고 말합니다."
- LLM: Ollama `http://localhost:11434`, 모델 `qwen3.5:2b`, `POST /api/chat`, 본문은 `{ model, messages, stream: true, think: false, options: { temperature: 0 } }`.
  - 응답은 줄바꿈으로 구분된 JSON(NDJSON). `TextDecoder`는 `{ stream: true }`로 써서 한글이 조각 경계에서 깨지지 않게 한다.
- 근거 표시는 LLM에 맡기지 않는다. 답변 뒤에 LLM에게 넘긴 자료를 모두 보여 주고, 답변에 ID가 적힌 자료에 ✓를 붙인다.
- Ollama 연결 확인은 실제로 LLM을 호출할 때만 한다(`--show-prompt`는 Ollama 없이도 동작). 연결이 안 되면 "Ollama가 실행 중인지 확인하세요"와 확인 명령을 안내하고 종료한다.

## 결정 필요
- 1단계와 2단계의 실행 방법(명령어, 입출력 형태)은?
