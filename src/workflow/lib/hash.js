import { randomBytes } from "node:crypto";

export function generateId() {
  return randomBytes(2).toString("hex");
}

export function prefixTitle(title) {
  const id = generateId();
  return `${id}: ${title}`;
}

export function extractId(prefixedTitle) {
  const m = prefixedTitle.match(/^([0-9a-f]{4}): /);
  return m ? m[1] : null;
}
