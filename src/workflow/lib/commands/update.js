import { WorkflowCommand } from "../base-command.js";
import { searchItems, updateDraftIssue, setItemStatus } from "../graphql.js";
import { findItem, ensureStatusOption } from "../board-helpers.js";
import { assertJapaneseDraft, stripHashPrefix } from "../validation.js";

export default class UpdateCommand extends WorkflowCommand {
  execute(ctx) {
    const { boardConfig } = ctx;
    const hash = ctx.hash;
    const status = ctx.status ?? null;
    const body = ctx.body ?? null;
    const title = ctx.title ?? null;

    if (!hash) throw new Error("hash is required");
    if (status === null && body === null && title === null) {
      throw new Error("specify at least one of --status, --body, --title");
    }

    const { nodes } = searchItems(boardConfig.owner, boardConfig.project, hash);
    const item = findItem(nodes, hash);
    if (!item) throw new Error(`hash "${hash}" not found`);

    const result = { hash };

    if (title !== null || body !== null) {
      const draftId = item.content?.draftId;
      if (!draftId) {
        throw new Error("cannot update title/body of an item already converted to issue");
      }
      const currentTitle = stripHashPrefix(item.content?.title || "");
      const nextTitle = title !== null ? title : currentTitle;
      const nextBody = body !== null ? body : item.content?.body;
      assertJapaneseDraft(nextTitle, nextBody, { allowEmptyBody: true });
      const newTitle = title !== null ? `${hash}: ${title}` : undefined;
      updateDraftIssue(draftId, { title: newTitle, body: body ?? undefined });
      if (title !== null) result.titleUpdated = newTitle;
      if (body !== null) result.bodyUpdated = true;
    }

    if (status !== null) {
      const { meta, optionId } = ensureStatusOption(boardConfig, status);
      setItemStatus(meta.projectId, item.id, meta.statusField.id, optionId);
      result.statusUpdated = status;
    }

    return result;
  }
}
