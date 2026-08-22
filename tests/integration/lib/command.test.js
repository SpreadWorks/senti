import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Container } from "../../../src/lib/container.js";
import { Command } from "../../../src/lib/command.js";

describe("Command (unified base class)", () => {
  describe("run(container, input) → execute(ctx)", () => {
    it("calls execute() with context assembled from container and merged input", async () => {
      class EchoCmd extends Command {
        execute(ctx) {
          return { seen: ctx };
        }
      }
      const c = new Container();
      c.register("config", { lang: "ja" });
      c.register("root", "/tmp/root");
      const cmd = new EchoCmd();
      const result = await cmd.run(c, { foo: 1 });
      assert.equal(result.seen.foo, 1);
      assert.ok(result.seen.container === c || result.seen.config != null);
    });

    it("throws if execute() is not implemented", async () => {
      const cmd = new Command();
      await assert.rejects(() => cmd.run(new Container(), {}), /execute/);
    });
  });

  describe("outputMode declaration (R5)", () => {
    it("exposes outputMode as either 'envelope' or 'raw'", () => {
      class E extends Command {
        static outputMode = "envelope";
        execute() {}
      }
      class R extends Command {
        static outputMode = "raw";
        execute() {}
      }
      assert.equal(E.outputMode, "envelope");
      assert.equal(R.outputMode, "raw");
    });

    it("rejects unknown outputMode when validated at registration time", () => {
      class X extends Command {
        static outputMode = "invalid";
        execute() {}
      }
      assert.throws(() => Command.validate(X), /outputMode/);
    });
  });
});
