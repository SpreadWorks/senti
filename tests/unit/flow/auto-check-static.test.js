import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateStaticGates } from "../../../src/flow/lib/auto-check-static.js";

describe("auto-check static gates", () => {
  describe("G (high-risk keywords)", () => {
    it("hits on English 'password' keyword", () => {
      const result = evaluateStaticGates("reset user password in admin panel");
      assert.equal(result.G, true);
      assert.equal(result.eligible, false);
    });

    it("hits on English 'migration' keyword", () => {
      const result = evaluateStaticGates("run database migration for new schema");
      assert.equal(result.G, true);
    });

    it("hits on English 'npm publish'", () => {
      const result = evaluateStaticGates("prepare npm publish for 0.2.0");
      assert.equal(result.G, true);
    });

    it("hits on Japanese 'パスワード'", () => {
      const result = evaluateStaticGates("パスワード変更機能を追加する");
      assert.equal(result.G, true);
    });

    it("hits on Japanese '認証'", () => {
      const result = evaluateStaticGates("認証フローを見直す");
      assert.equal(result.G, true);
    });

    it("does not hit on unrelated text", () => {
      const result = evaluateStaticGates("ボタンの色を赤に変える");
      assert.equal(result.G, false);
    });
  });

  describe("H (external contract keywords)", () => {
    it("hits on 'breaking change'", () => {
      const result = evaluateStaticGates("this introduces a breaking change to the API");
      assert.equal(result.H, true);
      assert.equal(result.eligible, false);
    });

    it("hits on 'public interface'", () => {
      const result = evaluateStaticGates("refactor the public interface of Foo");
      assert.equal(result.H, true);
    });

    it("hits on Japanese '破壊的変更'", () => {
      const result = evaluateStaticGates("破壊的変更を含む修正");
      assert.equal(result.H, true);
    });

    it("does not hit on benign text", () => {
      const result = evaluateStaticGates("improve readme wording");
      assert.equal(result.H, false);
    });
  });

  describe("I (contradiction keywords)", () => {
    it("hits when two inversion markers coexist", () => {
      const result = evaluateStaticGates("do X but NOT Y, except when Z");
      assert.equal(result.I, true);
      assert.equal(result.eligible, false);
    });

    it("does not hit on single inversion", () => {
      const result = evaluateStaticGates("do X except on weekends");
      assert.equal(result.I, false);
    });

    it("hits on Japanese double 'ただし'", () => {
      const result = evaluateStaticGates("機能を追加する。ただし X は除く。ただし Y は含める。");
      assert.equal(result.I, true);
    });
  });

  describe("eligible composite", () => {
    it("returns eligible:true when no gates hit", () => {
      const result = evaluateStaticGates("add a progress bar to the CLI output");
      assert.equal(result.G, false);
      assert.equal(result.H, false);
      assert.equal(result.I, false);
      assert.equal(result.eligible, true);
    });

    it("returns eligible:false if any gate hits", () => {
      const result = evaluateStaticGates("password reset with breaking change");
      assert.equal(result.eligible, false);
    });

    it("handles empty input safely (eligible:true, all gates false)", () => {
      const result = evaluateStaticGates("");
      assert.equal(result.G, false);
      assert.equal(result.H, false);
      assert.equal(result.I, false);
      assert.equal(result.eligible, true);
    });
  });
});
