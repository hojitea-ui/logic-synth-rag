import { readFile, writeFile } from "node:fs/promises";
import { MODEL, DTYPE, DIM, embedDocument } from "./embedder.mjs";

const CHUNKS_PATH = "data/chunks.json";
const VECTORS_PATH = "data/vectors.json";
const FIELDS = ["id", "text", "url", "section"];
const MIN_TEXT_LENGTH = 120;

function fail(message) {
  console.error("✗ " + message);
  process.exit(1);
}

function validate(chunks) {
  if (!Array.isArray(chunks)) fail(`${CHUNKS_PATH}는 배열이어야 한다.`);
  const seen = new Set();
  chunks.forEach((chunk, i) => {
    for (const field of FIELDS) {
      if (typeof chunk[field] !== "string" || chunk[field].trim() === "") {
        fail(`${i + 1}번째 청크(${chunk.id ?? "id 없음"})에 '${field}' 필드가 없거나 비어 있다.`);
      }
    }
    if (seen.has(chunk.id)) fail(`중복 id: ${chunk.id}`);
    seen.add(chunk.id);
    if (chunk.text.length < MIN_TEXT_LENGTH) {
      console.warn(`⚠ ${chunk.id}: text가 ${chunk.text.length}자 (최소 ${MIN_TEXT_LENGTH}자)`);
    }
  });
}

const chunks = JSON.parse(await readFile(CHUNKS_PATH, "utf8"));
validate(chunks);

const indexed = [];
for (const chunk of chunks) {
  const vector = await embedDocument(chunk);
  if (vector.length !== DIM) fail(`${chunk.id}: 벡터가 ${vector.length}차원이다 (기대: ${DIM}).`);
  indexed.push({ id: chunk.id, text: chunk.text, url: chunk.url, section: chunk.section, vector });
  console.log(`✓ ${chunk.id} (${chunk.section})`);
}

const store = { model: MODEL, dtype: DTYPE, dim: DIM, createdAt: new Date().toISOString(), chunks: indexed };
await writeFile(VECTORS_PATH, JSON.stringify(store), "utf8");
console.log(`저장: ${VECTORS_PATH} — ${indexed.length}청크 × ${DIM}차원`);

const first = indexed[0].vector;
const norm = Math.sqrt(first.reduce((sum, x) => sum + x * x, 0));
console.log(`첫 청크(${indexed[0].id}) 벡터 앞 5개: [${first.slice(0, 5).map((x) => x.toFixed(4)).join(", ")}]`);
console.log(`벡터 길이(노름): ${norm.toFixed(4)} (1.0이어야 함)`);
