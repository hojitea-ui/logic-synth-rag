import { pathToFileURL } from "node:url";
import { search } from "./search.mjs";
import { SYSTEM_MESSAGE, buildPrompt } from "./prompt.mjs";

const TOP_K = 3;

async function main() {
  const args = process.argv.slice(2);
  const showPrompt = args.includes("--show-prompt");
  const question = args.find((a) => a !== "--show-prompt");
  if (!question) {
    console.error('사용법: node src/ask.mjs "질문" --show-prompt');
    process.exit(1);
  }
  if (!showPrompt) {
    console.error("아직 --show-prompt만 지원합니다(LLM 호출은 아직 없음).");
    process.exit(1);
  }

  const hits = await search(question, TOP_K);
  console.log("=== system ===");
  console.log(SYSTEM_MESSAGE);
  console.log("\n=== user ===");
  console.log(buildPrompt(question, hits));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
