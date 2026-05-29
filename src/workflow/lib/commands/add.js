import { execFileSync } from "node:child_process";
import { WorkflowCommand } from "../base-command.js";
import { prefixTitle } from "../hash.js";
import { prefixCategory } from "../category.js";
import { assertJapaneseDraft } from "../validation.js";
import { setItemStatus } from "../graphql.js";
import { ensureStatusOption } from "../board-helpers.js";

export default class AddCommand extends WorkflowCommand {
  execute(ctx) {
    const { boardConfig } = ctx;
    const rawTitle = ctx.title;
    const status = ctx.status || "Ideas";
    const category = ctx.category || null;
    const body = ctx.body || null;

    if (!rawTitle) {
      throw new Error("title is required");
    }
    assertJapaneseDraft(rawTitle, body, { allowEmptyBody: true });

    const categorized = prefixCategory(rawTitle, category);
    const title = prefixTitle(categorized);

    const ghArgs = [
      "project", "item-create", String(boardConfig.project),
      "--owner", boardConfig.owner,
      "--title", title,
      "--format", "json",
    ];
    if (body) ghArgs.push("--body", body);
    const out = execFileSync("gh", ghArgs, { encoding: "utf8" });
    const created = JSON.parse(out);

    const { meta, optionId } = ensureStatusOption(boardConfig, status);
    setItemStatus(meta.projectId, created.id, meta.statusField.id, optionId);

    return { title, status, category, itemId: created.id };
  }
}
