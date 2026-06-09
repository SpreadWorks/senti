import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { before, after } from "node:test";

export function createTmpDir(prefix = "senti-test-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function removeTmpDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

export function writeJson(dir, relPath, data) {
  const full = join(dir, relPath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, JSON.stringify(data, null, 2));
}

export function writeFile(dir, relPath, content = "") {
  const full = join(dir, relPath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
}

/**
 * Register before/after hooks for a temporary directory and return a getter.
 * Must be called at describe-block level (not inside it()).
 *
 * @param {string} [prefix]
 * @returns {() => string} getter that returns the tmp dir path
 */
export function useTmpDir(prefix = "senti-test-") {
  let dir;
  before(() => { dir = createTmpDir(prefix); });
  after(() => { removeTmpDir(dir); });
  return () => dir;
}
