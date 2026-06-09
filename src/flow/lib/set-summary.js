/**
 * src/flow/lib/set-summary.js
 *
 * Deprecated in spec 219: `flow set summary` was used to mirror spec.json.requirements
 * into flow state. Now that spec.json is the single source of truth, this command
 * has no purpose and returns a non-zero envelope explaining the deprecation.
 */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";

export default class SetSummaryCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  execute() {
    return Envelope.fail(
      "set",
      "summary",
      "DEPRECATED",
      [
        "`senti flow set summary` is deprecated and has been removed.",
        "Requirements live in spec.json and are finalized when the spec gate passes — no manual transfer step is needed.",
      ],
    );
  }
}
