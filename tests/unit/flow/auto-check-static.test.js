import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateStaticGates } from "../../../src/flow/lib/auto-check-static.js";

describe("auto-check static gates (spec 225: G_KEYWORDS reduction)", () => {
  describe("G — retained keywords (shall hit)", () => {
    const retained = [
      ["password", "reset user password"],
      ["credential", "rotate the aws credential"],
      ["secret", "store api secret"],
      ["token", "refresh the access token"],
      ["authentication", "rework the authentication module"],
      ["npm publish", "prepare npm publish for 0.2.0"],
      ["破壊的", "破壊的な変更を導入"],
      ["パスワード", "パスワード変更機能を追加"],
      ["認証情報", "認証情報の保存方法を見直す"],
    ];

    for (const [kw, sample] of retained) {
      it(`hits on retained keyword '${kw}'`, () => {
        assert.equal(evaluateStaticGates(sample).G, true, `sample '${sample}' should trigger G`);
      });
    }
  });

  describe("G — removed keywords (shall NOT hit)", () => {
    const removed = [
      ["security", "improve security posture"],
      ["auth", "refactor the auth module"],
      ["migration", "run database migration for new schema"],
      ["migrate", "migrate the config file"],
      ["delete", "delete obsolete entries"],
      ["drop", "drop the dropdown menu ui"],
      ["destructive", "avoid destructive changes"],
      ["release", "update release notes"],
      ["認証", "認証フローを見直す"],
      ["トークン", "トークン発行のテストを足す"],
      ["資格情報", "資格情報ストアの振る舞いを検証"],
      ["マイグレーション", "マイグレーションスクリプトを整理"],
      ["削除", "不要な削除処理を見直す"],
      ["リリース", "リリースノートを更新"],
    ];

    for (const [kw, sample] of removed) {
      it(`does not hit on removed keyword '${kw}'`, () => {
        const out = evaluateStaticGates(sample);
        assert.equal(out.G, false, `sample '${sample}' should not trigger G after removal of '${kw}'`);
      });
    }
  });

  describe("G — false positive demonstration", () => {
    it("does not hit on 'author' (previously matched by 'auth' substring)", () => {
      assert.equal(evaluateStaticGates("update author metadata").G, false);
    });

    it("does not hit on 'deleted line' (previously matched by 'delete' substring)", () => {
      assert.equal(evaluateStaticGates("refactor deleted line handling").G, false);
    });

    it("does not hit on 'migration guide' (previously matched by 'migration' substring)", () => {
      assert.equal(evaluateStaticGates("update the migration guide text").G, false);
    });
  });

  describe("H — unchanged (regression)", () => {
    it("hits on 'breaking change'", () => {
      assert.equal(evaluateStaticGates("this introduces a breaking change to the API").H, true);
    });

    it("hits on 'public interface'", () => {
      assert.equal(evaluateStaticGates("refactor the public interface of Foo").H, true);
    });

    it("hits on Japanese '破壊的変更'", () => {
      assert.equal(evaluateStaticGates("破壊的変更を含む修正").H, true);
    });

    it("does not hit on benign text", () => {
      assert.equal(evaluateStaticGates("improve readme wording").H, false);
    });
  });

  describe("I — unchanged (regression)", () => {
    it("hits when two inversion markers coexist", () => {
      assert.equal(evaluateStaticGates("do X but NOT Y, except when Z").I, true);
    });

    it("does not hit on single inversion", () => {
      assert.equal(evaluateStaticGates("do X except on weekends").I, false);
    });

    it("hits on Japanese double 'ただし'", () => {
      assert.equal(evaluateStaticGates("機能追加。ただし X は除く。ただし Y は含める").I, true);
    });
  });

  describe("eligible composite", () => {
    it("returns eligible:true when no gates hit", () => {
      const out = evaluateStaticGates("add a progress bar to the CLI output");
      assert.equal(out.eligible, true);
    });

    it("returns eligible:false when G hits on retained keyword", () => {
      const out = evaluateStaticGates("password reset flow");
      assert.equal(out.eligible, false);
    });

    it("returns eligible:true for previously-hit removed keyword", () => {
      const out = evaluateStaticGates("database migration script refactor");
      assert.equal(out.eligible, true, "migration removal should lift the block");
    });

    it("handles empty input (eligible:true, all gates false)", () => {
      const out = evaluateStaticGates("");
      assert.equal(out.eligible, true);
    });
  });
});
