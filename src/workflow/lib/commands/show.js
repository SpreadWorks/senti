import { WorkflowCommand } from "../base-command.js";
import { searchItems } from "../graphql.js";
import { findItem } from "../board-helpers.js";

export default class ShowCommand extends WorkflowCommand {
  execute(ctx) {
    const { boardConfig } = ctx;
    const hash = ctx.hash;
    if (!hash) throw new Error("hash is required");

    const { nodes } = searchItems(boardConfig.owner, boardConfig.project, hash);
    const item = findItem(nodes, hash);
    if (!item) {
      throw new Error(`hash "${hash}" not found`);
    }

    const c = item.content || {};
    return {
      hash,
      title: c.title || null,
      status: item.fieldValueByName?.name || null,
      issueNumber: c.number || null,
      issueUrl: c.url || null,
      body: c.body || null,
    };
  }
}
