import { execFileSync } from "node:child_process";
import { WorkflowCommand } from "../base-command.js";
import {
  searchItems,
  updateDraftIssue,
  convertDraftToIssue,
  getRepositoryId,
  setItemStatus,
} from "../graphql.js";
import { findItem, parseJsonResponse, ensureStatusOption } from "../board-helpers.js";
import { assertJapaneseDraft, assertJapaneseDraftField, stripHashPrefix } from "../validation.js";
import { container } from "../../../lib/container.js";

const COMMAND_ID = "workflow.publish";
const PUBLISH_RETRY_COUNT = 2;

export default class PublishCommand extends WorkflowCommand {
  async execute(ctx) {
    const { boardConfig, config, root } = ctx;
    const hash = ctx.hash;
    const labels = ctx.labels || (ctx.label ? [ctx.label] : []);

    if (!hash) throw new Error("hash is required");

    // 1. Fetch draft
    const { nodes } = searchItems(boardConfig.owner, boardConfig.project, hash);
    const item = findItem(nodes, hash);
    if (!item) throw new Error(`hash "${hash}" not found`);
    if (item.content?.number) {
      throw new Error(`already published as issue #${item.content.number}`);
    }

    const sourceLang = config.workflow?.languages?.source ?? config.lang;
    const publishLang = config.workflow?.languages?.publish ?? config.lang;

    const c = item.content;
    const sourceTitle = stripHashPrefix(c.title || "");
    const sourceBody = c.body || "";

    let issueTitle;
    let issueBody;

    if (sourceLang === publishLang) {
      // Same language: publish as-is
      issueTitle = `${hash}: ${sourceTitle}`;
      issueBody = sourceBody;
    } else {
      // Different language: translate
      assertJapaneseDraft(sourceTitle, sourceBody, { allowEmptyBody: true });

      const prompt = `Translate the following ${sourceLang} GitHub issue title and body to ${publishLang}. Output ONLY valid JSON with "title" and "body" keys. Do not include any other text.

Title: ${sourceTitle}

Body:
${sourceBody || "(empty)"}`;

      const agent = container.get("agent");
      if (!agent.resolve(COMMAND_ID)) {
        throw new Error(`no agent configured for ${COMMAND_ID}`);
      }

      const translated = await agent.call(prompt, {
        commandId: COMMAND_ID,
        retryCount: PUBLISH_RETRY_COUNT,
      });
      const result = parseJsonResponse(translated);
      issueTitle = `${hash}: ${result.title}`;
      assertJapaneseDraftField("draft title", sourceTitle);
      issueBody = `${result.body}

---

<details>
<summary>${sourceLang}</summary>

${sourceTitle}

${sourceBody}

</details>`;
    }

    // Update draft to publish-language content
    const draftId = c.draftId;
    updateDraftIssue(draftId, { title: issueTitle, body: issueBody });

    // Convert draft to issue
    const [repoOwner, repoName] = boardConfig.repo.split("/");
    const repositoryId = getRepositoryId(repoOwner, repoName);
    const converted = convertDraftToIssue(item.id, repositoryId);
    const issueNumber = converted.content?.number;
    const issueUrl = converted.content?.url;

    // Apply labels
    if (labels.length > 0 && issueNumber) {
      execFileSync(
        "gh",
        [
          "issue",
          "edit",
          String(issueNumber),
          ...labels.flatMap((l) => ["--add-label", l]),
          "--repo",
          boardConfig.repo,
        ],
        { encoding: "utf8", timeout: 30_000 },
      );
    }

    const { meta, optionId } = ensureStatusOption(boardConfig, "Todo");
    setItemStatus(meta.projectId, item.id, meta.statusField.id, optionId);
    // GitHub Projects v2 Board layout caches column membership from the draft
    // state; a second status write after a short delay forces the board view
    // to re-group the converted item into the Todo column.
    await new Promise((r) => setTimeout(r, 500));
    setItemStatus(meta.projectId, item.id, meta.statusField.id, optionId);

    return {
      hash,
      issueNumber,
      issueUrl,
      labels,
      statusUpdated: "Todo",
    };
  }

}
