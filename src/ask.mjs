import { pathToFileURL } from "node:url";
import { search, WEAK_THRESHOLD } from "./search.mjs";
import { SYSTEM_MESSAGE, buildPrompt } from "./prompt.mjs";
import { pingOllama, chatStream } from "./ollama.mjs";

const DEFAULT_K = 3;
const USAGE = '사용법: node src/ask.mjs "질문" [--k 3] [--show-prompt] [--no-rag]';
const OLLAMA_HINT = "Ollama가 실행 중인지 확인하세요 (확인: curl.exe http://localhost:11434/api/tags)";

function parseArgs(argv) {
  const opts = { question: null, k: DEFAULT_K, showPrompt: false, noRag: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--k") opts.k = Number(argv[++i]);
    else if (a === "--show-prompt") opts.showPrompt = true;
    else if (a === "--no-rag") opts.noRag = true;
    else if (opts.question === null) opts.question = a;
  }
  return opts;
}

const seconds = (ms) => (ms / 1000).toFixed(1);

async function askLlm(messages, onToken) {
  if (!(await pingOllama())) {
    console.error(OLLAMA_HINT);
    process.exit(1);
  }
  return chatStream(messages, onToken);
}

async function main() {
  const { question, k, showPrompt, noRag } = parseArgs(process.argv.slice(2));
  if (!question || !Number.isInteger(k) || k < 1) {
    console.error(USAGE);
    process.exit(1);
  }

  if (noRag) {
    console.log("💬 답변");
    const t0 = performance.now();
    await askLlm([{ role: "user", content: question }], (t) => process.stdout.write(t));
    console.log(`\n\n⏱ 답변 ${seconds(performance.now() - t0)}초`);
    return;
  }

  const t0 = performance.now();
  const hits = await search(question, k);
  const searchMs = performance.now() - t0;
  const weak = hits.length === 0 || hits[0].score < WEAK_THRESHOLD;
  const messages = [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: buildPrompt(question, hits) },
  ];

  if (showPrompt) {
    console.log("=== system ===");
    console.log(messages[0].content);
    console.log("\n=== user ===");
    console.log(messages[1].content);
    return;
  }

  console.log(`🔎 검색 결과${weak ? "  ⚠ 관련 자료가 약함" : ""}`);
  hits.forEach((h) => {
    console.log(`  ${weak ? "⚠ " : ""}${h.id}  ${h.score.toFixed(3)}  ${h.section}`);
  });

  console.log("\n💬 답변");
  const t1 = performance.now();
  const answer = await askLlm(messages, (t) => process.stdout.write(t));
  const answerMs = performance.now() - t1;

  console.log("\n\n📚 근거 (LLM에게 넘긴 자료 · ✓ = 답변에 ID가 표시된 자료)");
  let anyCited = false;
  hits.forEach((h) => {
    const cited = answer.includes(h.id);
    anyCited ||= cited;
    console.log(`  ${cited ? "✓" : " "} ${h.id}  ${h.section}  ${h.url}`);
  });
  if (weak) {
    console.log("  ⚠ 관련 자료가 약해 이 자료들을 답변의 근거로 보기 어렵습니다");
  } else if (!anyCited) {
    console.log("  (답변에 ID 표시가 없습니다. 위 자료와 답변을 비교해 확인하세요)");
  }

  console.log(`\n⏱ 검색 ${seconds(searchMs)}초 / 답변 ${seconds(answerMs)}초`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
