import { WEAK_THRESHOLD } from "./search.mjs";

export const SYSTEM_MESSAGE =
  "당신은 Logic Pro의 악기·MIDI FX·이펙트를 안내하는 도우미입니다. 사용자는 신스웨이브·신스팝을 만들려는 입문자입니다. 주어진 자료에 근거한 내용만 답하고, 자료에 없는 정보는 '제가 가진 자료에는 없습니다'라고 답합니다. 장르 이름만으로 추천하라는 질문, 노브 수치(예: Cutoff를 몇으로 맞출지), 작곡·믹싱 조언, 자료에 없는 플러그인이나 다른 프로그램에 관한 질문에는 이 도우미가 설명서에 적힌 기능 설명만 안내한다고 말하고, 정확한 내용은 Logic Pro 앱이나 공식 설명서에서 확인하라고 안내합니다. 근거 조각의 ID만 [LP-010]처럼 대괄호로 감싸 해당 문장 끝에 표시합니다.";

const INTRO = "다음 자료는 Logic Pro 12.3 공식 설명서에서 뽑은 조각입니다.";
const PRINCIPLE_NORMAL = "자료에 근거한 내용만 답하고, 자료에 없으면 없다고 말합니다.";
const PRINCIPLE_WEAK =
  "주의: 검색된 조각의 유사도가 낮습니다. 질문과 완전히 맞는 근거가 아닐 수 있으니, 근거에 있는 내용만 짧게 답하고 자료에 없는 부분은 없다고 말합니다.";
const CITE_RULE = "근거가 된 조각의 ID만 [LP-012]처럼 대괄호로 감싸 해당 문장 끝에 표시합니다.";
const CITE_REMINDER = "(답할 때 근거로 쓴 자료의 ID를 [LP-012]처럼 문장 끝에 붙입니다.)";

const kstFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
  hour: "numeric",
  minute: "numeric",
});

export function buildPrompt(question, hits) {
  const weak = hits.length === 0 || hits[0].score < WEAK_THRESHOLD;
  const now =
    `현재 시각은 ${kstFormat.format(new Date())}(KST)입니다. ` +
    "'지금', '올해', '다음 주' 같은 상대 표현은 이 시각을 기준으로 해석합니다.";
  const sources = hits.map((h) => `[${h.id}] (${h.section}) ${h.text}`).join("\n\n");

  return [
    INTRO,
    weak ? PRINCIPLE_WEAK : PRINCIPLE_NORMAL,
    CITE_RULE,
    now,
    "",
    "[자료]",
    sources,
    "",
    "[질문]",
    question,
    "",
    CITE_REMINDER,
  ].join("\n");
}
