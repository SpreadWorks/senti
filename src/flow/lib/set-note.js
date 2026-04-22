/**
 * src/flow/lib/set-note.js
 *
 * Append a note entry to state.notes in flow.json.
 *
 * ctx.text    — note text (required)
 * ctx.taskId  — optional explicit taskId (overrides active-task inference)
 */

import { FlowCommand, resolveExplicitTaskOption } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";

export default class SetNoteCommand extends FlowCommand {
  execute(ctx) {
    const { text } = ctx;

    if (!text) {
      return Envelope.fail(
        "set",
        "note",
        "INVALID_USAGE",
        'usage: flow set note "<text>" [--task-id <id>]',
      );
    }

    ctx.flowManager.addNote(text, resolveExplicitTaskOption(ctx));

    return { note: text };
  }
}
