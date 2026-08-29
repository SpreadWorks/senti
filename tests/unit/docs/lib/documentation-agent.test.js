import { test } from "node:test";
import assert from "node:assert/strict";

import { DocumentationAgent } from "../../../../src/docs/lib/documentation-agent.js";

test("documentation agent disables ambient Flow attribution for every provider call", async () => {
  const calls = [];
  const underlying = {
    resolve: () => ({ provider: "fixture" }),
    call: async (prompt, options) => {
      calls.push({ prompt, options });
      return "generated documentation";
    },
  };
  const agent = DocumentationAgent.from(underlying);

  assert.deepEqual(agent.resolve("docs.text"), { provider: "fixture" });
  assert.equal(await agent.call("document this", {
    commandId: "docs.text",
    flowAttribution: "ambient",
  }), "generated documentation");
  assert.deepEqual(calls, [{
    prompt: "document this",
    options: {
      commandId: "docs.text",
      flowAttribution: "none",
    },
  }]);
});
