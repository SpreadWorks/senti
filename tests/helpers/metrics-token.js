import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { writeJson } from "./tmp-dir.js";

export const SENTI = join(process.cwd(), "src/senti.js");

export function writeBaseConfig(tmp) {
  writeJson(tmp, ".senti/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  });
}

export function runToken(tmp, args = []) {
  return execFileSync("node", [SENTI, "metrics", "token", ...args], {
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    cwd: tmp,
  });
}

export function runTokenJson(tmp) {
  return runToken(tmp, ["--format", "json"]);
}

export function runTokenCapture(tmp, args = ["--format", "json"]) {
  const res = spawnSync("node", [SENTI, "metrics", "token", ...args], {
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    cwd: tmp,
  });
  return { stdout: res.stdout ?? "", stderr: res.stderr ?? "", status: res.status };
}
