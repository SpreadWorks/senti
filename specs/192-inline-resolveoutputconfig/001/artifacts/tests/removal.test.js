#!/usr/bin/env node
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(__dirname, "../../../src");
const TARGET = "resolveOutputConfig";

const MAX_FILES = 5000;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_DEPTH = 12;

async function walk(dir, depth, acc) {
  if (depth > MAX_DEPTH) throw new Error(`walk depth exceeded ${MAX_DEPTH} at ${dir}`);
  for (const name of await readdir(dir)) {
    if (acc.length > MAX_FILES) throw new Error(`too many files scanned (>${MAX_FILES})`);
    const full = join(dir, name);
    const st = await stat(full);
    if (st.isDirectory()) await walk(full, depth + 1, acc);
    else if (name.endsWith(".js")) acc.push(full);
  }
}

const files = [];
await walk(srcRoot, 0, files);

const matches = [];
for (const f of files) {
  const st = await stat(f);
  if (st.size > MAX_FILE_BYTES) continue;
  const content = await readFile(f, "utf8");
  if (content.includes(TARGET)) matches.push(f);
}

if (matches.length > 0) {
  console.error(`FAIL: identifier "${TARGET}" still present in:`);
  for (const m of matches) console.error(`  - ${m.replace(srcRoot + "/", "src/")}`);
  process.exit(1);
}

console.log(`PASS: identifier "${TARGET}" has been fully removed from src/`);
