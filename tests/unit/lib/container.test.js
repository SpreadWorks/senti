import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { Container } from "../../../src/lib/container.js";

describe("Container", () => {
  let c;
  beforeEach(() => {
    c = new Container();
  });

  describe("register / get / has", () => {
    it("registers a named dependency and retrieves it", () => {
      const service = { foo: 1 };
      c.register("svc", service);
      assert.equal(c.get("svc"), service);
    });

    it("has() returns true after register, false otherwise", () => {
      assert.equal(c.has("svc"), false);
      c.register("svc", {});
      assert.equal(c.has("svc"), true);
    });

    it("throws on get() for unregistered key", () => {
      assert.throws(() => c.get("missing"), /missing/);
    });

    it("overwrite by re-register is allowed (support test mocks)", () => {
      c.register("svc", { v: 1 });
      c.register("svc", { v: 2 });
      assert.equal(c.get("svc").v, 2);
    });
  });

  describe("reset", () => {
    it("clears all registered dependencies", () => {
      c.register("a", 1);
      c.register("b", 2);
      c.reset();
      assert.equal(c.has("a"), false);
      assert.equal(c.has("b"), false);
      assert.throws(() => c.get("a"));
    });
  });

  describe("paths service invariants", () => {
    it("all provided paths are absolute", () => {
      const paths = {
        root: "/abs/root",
        srcRoot: "/abs/src",
        managedDir: "/abs/root/.sennel",
        outputDir: "/abs/root/.sennel/output",
        agentWorkDir: "/abs/root/.tmp",
        logDir: "/abs/root/.tmp/logs",
        configPath: "/abs/root/.sennel/config.json",
      };
      c.register("paths", paths);
      const got = c.get("paths");
      for (const key of Object.keys(got)) {
        assert.equal(path.isAbsolute(got[key]), true, `${key} must be absolute`);
      }
    });
  });
});
