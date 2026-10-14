import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { MODEL, DTYPE, embedQuery } from "./embedder.mjs";

export const WEAK_THRESHOLD = 0.55;

const VECTORS_PATH = "data/vectors.json";
const DEFAULT_K = 3;
const BAR_WIDTH = 20;
const PREVIEW_LENGTH = 60;

let storePromise = null;

function loadStore() {
  if (!storePromise) {
    storePromise = readFile(VECTORS_PATH, "utf8").then((raw) => {
      const store = JSON.parse(raw);
      if (store.model !== MODEL || store.dtype !== DTYPE) {
        throw new Error(
          `${VECTORS_PATH}는 ${store.model} / ${store.dtype}로 만들어졌고, 지금 embedder는 ${MODEL} / ${DTYPE}입니다. ` +
            "node src/build-index.mjs 를 다시 실행하세요(build-index를 다시 실행하라)."
        );
      }
      return store;
    });
  }
  return storePromise;
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export async function search(question, k = DEFAULT_K) {
  const store = await loadStore();
  const query = await embedQuery(question);
  return store.chunks
    .map(({ id, text, url, section, vector }) => ({ id, text, url, section, score: dot(query, vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function bar(score) {
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round(score * BAR_WIDTH)));
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function printResults(question, results) {
  const weak = results.length > 0 && results[0].score < WEAK_THRESHOLD;
  console.log(`Q: ${question}${weak ? `  ⚠ 관련 자료가 약함(<${WEAK_THRESHOLD})` : ""}`);
  results.forEach((r, i) => {
    const preview = r.text.length > PREVIEW_LENGTH ? r.text.slice(0, PREVIEW_LENGTH) + "…" : r.text;
    console.log(`  ${i + 1}. ${r.id}  ${r.score.toFixed(3)}  ${bar(r.score)}  [${r.section}]`);
    console.log(`     ${preview}`);
    console.log(`     출처: ${r.url}`);
  });
  console.log();
}

function parseArgs(argv) {
  const questions = [];
  let k = DEFAULT_K;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--k") {
      k = Number(argv[++i]);
    } else {
      questions.push(argv[i]);
    }
  }
  return { questions, k };
}

async function main() {
  const { questions, k } = parseArgs(process.argv.slice(2));
  if (questions.length === 0 || !Number.isInteger(k) || k < 1) {
    console.error('사용법: node src/search.mjs "질문1" ["질문2" …] [--k 3]  (k는 1 이상의 정수)');
    process.exit(1);
  }
  try {
    await loadStore();
  } catch (err) {
    console.error("✗ " + (err.code === "ENOENT" ? `${VECTORS_PATH}가 없습니다. node src/build-index.mjs 를 먼저 실행하세요.` : err.message));
    process.exit(1);
  }
  for (const question of questions) {
    printResults(question, await search(question, k));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
