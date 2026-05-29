import { WorkflowCommand } from "../base-command.js";
import { listItems } from "../graphql.js";
import { formatItem } from "../board-helpers.js";

export default class ListCommand extends WorkflowCommand {
  execute(ctx) {
    const { boardConfig } = ctx;
    const filterStatus = ctx.status || null;

    const { nodes, totalCount } = listItems(boardConfig.owner, boardConfig.project);
    let filtered = nodes;
    if (filterStatus) {
      filtered = nodes.filter((n) => n.fieldValueByName?.name === filterStatus);
    }

    return {
      totalCount,
      filterStatus,
      count: filtered.length,
      items: filtered.map(formatItem),
    };
  }
}
