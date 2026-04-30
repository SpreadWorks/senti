import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agentPath = path.resolve(__dirname, "../../../src/lib/agent.js");

describe("spec 248: streaming JSON filter in agent.js (R8)", () => {
  it("R8: agent.js exports or contains a streaming event filter", () => {
    const source = fs.readFileSync(agentPath, "utf8");
    const hasFilter =
      source.includes("filterStreamingEvents") ||
      source.includes("STREAMING_EVENT_TYPES") ||
      source.includes("message_start") ||
      source.includes("content_block_start");
    assert.ok(
      hasFilter,
      "agent.js should contain streaming event type references for the filter",
    );
  });

  it("R8: filter removes Claude CLI streaming event lines", async () => {
    const { filterStreamingEvents } = await loadFilter();
    const input = [
      '{"type":"message_start","message":{"id":"msg_01"}}',
      "Here is my analysis:",
      '{"type":"content_block_delta","delta":{"text":"hello"}}',
      "The code looks good.",
      '{"type":"message_stop"}',
    ].join("\n");

    const filtered = filterStreamingEvents(input);
    assert.ok(!filtered.includes("message_start"));
    assert.ok(!filtered.includes("content_block_delta"));
    assert.ok(!filtered.includes("message_stop"));
    assert.ok(filtered.includes("Here is my analysis:"));
    assert.ok(filtered.includes("The code looks good."));
  });

  it("R8: filter preserves intentional JSON output from AI", async () => {
    const { filterStreamingEvents } = await loadFilter();
    const input = [
      '{"result": "ok", "count": 5}',
      "Some text here",
    ].join("\n");

    const filtered = filterStreamingEvents(input);
    assert.ok(filtered.includes('"result": "ok"'));
    assert.ok(filtered.includes("Some text here"));
  });

  it("R8: filter preserves JSON inside code blocks", async () => {
    const { filterStreamingEvents } = await loadFilter();
    const input = [
      "Here is an example:",
      "```",
      '{"type":"message_start","message":{"id":"msg_01"}}',
      "```",
      "End of example.",
    ].join("\n");

    const filtered = filterStreamingEvents(input);
    assert.ok(
      filtered.includes("message_start"),
      "JSON inside code blocks should be preserved",
    );
  });

  it("R8: filter handles all specified event types", async () => {
    const { filterStreamingEvents } = await loadFilter();
    const eventTypes = [
      "message_start",
      "message_delta",
      "message_stop",
      "content_block_start",
      "content_block_delta",
      "content_block_stop",
    ];

    for (const type of eventTypes) {
      const input = `before\n{"type":"${type}","data":{}}\nafter`;
      const filtered = filterStreamingEvents(input);
      assert.ok(
        !filtered.includes(`"${type}"`),
        `event type "${type}" should be filtered out`,
      );
      assert.ok(filtered.includes("before"));
      assert.ok(filtered.includes("after"));
    }
  });
});

async function loadFilter() {
  const mod = await import(agentPath);
  if (mod.filterStreamingEvents) return mod;
  if (mod.default?.filterStreamingEvents) return mod.default;
  throw new Error("filterStreamingEvents not exported from agent.js — implement R8 first");
}
