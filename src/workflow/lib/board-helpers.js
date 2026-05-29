/**
 * src/workflow/lib/board-helpers.js
 *
 * Shared helpers for board item rendering and lookup.
 */

import { extractId } from "./hash.js";
import { getProjectMeta, addSingleSelectOption } from "./graphql.js";

const STATUS_NAME_MAX_LENGTH = 50;

export function ensureStatusOption(boardConfig, statusName) {
  if (typeof statusName !== "string" || statusName.length === 0) {
    throw new Error(`status name is required`);
  }
  if (statusName.length > STATUS_NAME_MAX_LENGTH) {
    throw new Error(
      `status name too long: ${statusName.length} chars (max ${STATUS_NAME_MAX_LENGTH})`,
    );
  }
  if (/[\x00-\x1f\x7f]/.test(statusName)) {
    throw new Error(`status name contains control characters`);
  }
  const meta = getProjectMeta(boardConfig.owner, boardConfig.project);
  if (!meta.statusField) {
    throw new Error(
      `board has no "Status" field. The board must have a SingleSelectField named "Status".`,
    );
  }
  const existing = meta.statusField.options.find((o) => o.name === statusName);
  if (existing) {
    return { meta, optionId: existing.id };
  }
  const optionId = addSingleSelectOption(meta.statusField.id, statusName);
  return { meta, optionId };
}

export function findItem(nodes, hash) {
  return nodes.find((n) => {
    const title = n.content?.title || "";
    return title.startsWith(`${hash}: `);
  });
}

export function formatItem(node) {
  const c = node.content || {};
  const status = node.fieldValueByName?.name || "—";
  const id = extractId(c.title || "") || "—";
  return {
    id,
    status,
    title: c.title || "(no title)",
    issueNumber: c.number || null,
    issueUrl: c.url || null,
  };
}

export function parseJsonResponse(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const lines = trimmed.split("\n");
    if (lines.length >= 3 && lines.at(-1) === "```") {
      return JSON.parse(lines.slice(1, -1).join("\n"));
    }
  }
  return JSON.parse(trimmed);
}
