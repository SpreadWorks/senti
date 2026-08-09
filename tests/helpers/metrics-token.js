import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { writeJson } from "./tmp-dir.js";

export const SENRAIL = join(process.cwd(), "src/senrail.js");

export function writeBaseConfig(tmp) {
  writeJson(tmp, ".senrail/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  });
}

export function runToken(tmp, args = []) {
  return execFileSync("node", [SENRAIL, "metrics", "token", ...args], {
    encoding: "utf8",
    env: { ...process.env, SENRAIL_WORK_ROOT: tmp, SENRAIL_SOURCE_ROOT: tmp },
    cwd: tmp,
  });
}

export function runTokenJson(tmp) {
  return runToken(tmp, ["--format", "json"]);
}

export function runTokenCapture(tmp, args = ["--format", "json"]) {
  const res = spawnSync("node", [SENRAIL, "metrics", "token", ...args], {
    encoding: "utf8",
    env: { ...process.env, SENRAIL_WORK_ROOT: tmp, SENRAIL_SOURCE_ROOT: tmp },
    cwd: tmp,
  });
  return { stdout: res.stdout ?? "", stderr: res.stderr ?? "", status: res.status };
}

export function readTokenCache(tmp) {
  return JSON.parse(readFileSync(join(tmp, ".senrail/output/metrics.json"), "utf8"));
}

export function writeTokenCache(tmp, cache) {
  writeFileSync(
    join(tmp, ".senrail/output/metrics.json"),
    `${JSON.stringify(cache, null, 2)}\n`,
    "utf8",
  );
}
