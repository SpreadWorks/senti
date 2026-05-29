import { WorkflowCommand } from "../base-command.js";
import { searchItems } from "../graphql.js";
import { formatItem } from "../board-helpers.js";

export default class SearchCommand extends WorkflowCommand {
  execute(ctx) {
    const { boardConfig } = ctx;
    const query = ctx.query;
    if (!query) throw new Error("query is required");

    const { nodes, totalCount } = searchItems(
      boardConfig.owner,
      boardConfig.project,
      query,
    );
    return {
      query,
      totalCount,
      items: nodes.map((n) => ({
        ...formatItem(n),
        bodyPreview: n.content?.body?.split("\n").slice(0, 3).join("\n") || null,
      })),
    };
  }
}
