import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../../../src/lib/config.js";

describe("validateConfig — agent.profiles", () => {
  const base = {
    lang: "ja",
    type: "sample-node-command",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  };

  // R2: BUILTIN_PROVIDERS のキーを参照した場合はパスする
  it("accepts profiles referencing a BUILTIN_PROVIDERS key", () => {
    const cfg = {
      ...base,
      agent: {
        default: "claude/sonnet",
        profiles: {
          default: {
            "docs.text": "claude/sonnet",
            "docs.enrich": "claude/opus",
          },
        },
      },
    };
    const result = validate(cfg);
    assert.equal(result.agent.profiles.default["docs.text"], "claude/sonnet");
  });

  // R2: ユーザー定義 providers にあるキーを参照した場合はパスする
  it("accepts profiles referencing a user-defined provider key", () => {
    const cfg = {
      ...base,
      agent: {
        default: "my-agent",
        providers: {
          "my-agent": { command: "my-cmd", args: ["{{PROMPT}}"] },
        },
        profiles: {
          default: {
            "flow.retro": "my-agent",
          },
        },
      },
    };
    assert.doesNotThrow(() => validate(cfg));
  });

  // R2: 存在しない provider キーを参照した場合はエラー
  it("throws when profiles reference an unknown provider key", () => {
    const cfg = {
      ...base,
      agent: {
        profiles: {
          default: {
            "context.search": "nonexistent-provider",
          },
        },
      },
    };
    assert.throws(() => validate(cfg), /profiles.*nonexistent-provider|nonexistent-provider.*profiles/i);
  });

  // R2: profiles がオブジェクトでない場合はエラー
  it("throws when agent.profiles is not an object", () => {
    const cfg = {
      ...base,
      agent: { profiles: "invalid" },
    };
    assert.throws(() => validate(cfg), /agent\.profiles/);
  });

  // R2: 各プロファイルがオブジェクトでない場合はエラー
  it("throws when a profile entry is not an object", () => {
    const cfg = {
      ...base,
      agent: {
        profiles: { default: "not-an-object" },
      },
    };
    assert.throws(() => validate(cfg), /agent\.profiles/);
  });

  // R2: プロファイルエントリの値が文字列でない場合はエラー
  it("throws when a profile command entry value is not a string", () => {
    const cfg = {
      ...base,
      agent: {
        profiles: {
          default: { "docs.text": 123 },
        },
      },
    };
    assert.throws(() => validate(cfg), /agent\.profiles/);
  });

  // R1: profiles が存在しない場合は通常通りパスする（省略可）
  it("accepts config without agent.profiles", () => {
    const cfg = {
      ...base,
      agent: { default: "claude/sonnet" },
    };
    assert.doesNotThrow(() => validate(cfg));
  });

  // GAP-3: profiles が配列の場合はエラー
  it("throws when agent.profiles is an array", () => {
    const cfg = {
      ...base,
      agent: { profiles: [] },
    };
    assert.throws(() => validate(cfg), /agent\.profiles/);
  });

  // GAP-4: プロファイルエントリの値が null の場合はエラー
  it("throws when a profile command entry value is null", () => {
    const cfg = {
      ...base,
      agent: {
        profiles: {
          default: { "docs.text": null },
        },
      },
    };
    assert.throws(() => validate(cfg), /agent\.profiles/);
  });

  // GAP-5: カスタム providers がある場合でも BUILTIN key を参照できる
  it("accepts profiles referencing BUILTIN key even when custom providers exist", () => {
    const cfg = {
      ...base,
      agent: {
        default: "my-agent",
        providers: {
          "my-agent": { command: "my-cmd", args: ["{{PROMPT}}"] },
        },
        profiles: {
          default: {
            "docs.text": "claude/sonnet",
          },
        },
      },
    };
    assert.doesNotThrow(() => validate(cfg));
  });

  // GAP-6: 1つ有効 + 1つ不正な provider キーの場合、不正キーをエラーメッセージに含む
  it("throws citing the bad provider key when one valid and one bad entry exist", () => {
    const cfg = {
      ...base,
      agent: {
        default: "claude/sonnet",
        profiles: {
          default: {
            "docs.text": "claude/sonnet",
            "docs.enrich": "ghost",
          },
        },
      },
    };
    assert.throws(() => validate(cfg), /ghost/);
  });

  // GAP-7: profiles が空オブジェクト、またはプロファイルが空オブジェクトの場合はパスする
  it("accepts profiles: {} (empty profiles map)", () => {
    const cfg = {
      ...base,
      agent: { profiles: {} },
    };
    assert.doesNotThrow(() => validate(cfg));
  });

  it("accepts profiles: { default: {} } (empty profile)", () => {
    const cfg = {
      ...base,
      agent: {
        profiles: { default: {} },
      },
    };
    assert.doesNotThrow(() => validate(cfg));
  });

  // GAP-8: validateConfig のフルラウンドトリップ — 戻り値が利用可能なオブジェクトを返す
  it("full round-trip: validateConfig with profiles returns a usable object", () => {
    const cfg = {
      ...base,
      agent: {
        default: "claude/sonnet",
        profiles: {
          default: {
            "docs.text": "claude/sonnet",
            "docs.enrich": "claude/opus",
          },
          fast: {
            "docs.text": "codex/gpt-5.6-terra-low",
          },
        },
      },
    };
    const result = validate(cfg);
    assert.equal(typeof result, "object");
    assert.equal(result.agent.profiles.default["docs.text"], "claude/sonnet");
    assert.equal(result.agent.profiles.fast["docs.text"], "codex/gpt-5.6-terra-low");
  });

  // GAP-8: src/lib/types.js モジュールのインポートが失敗しない
  it("importing src/lib/types.js does not reject", async () => {
    await assert.doesNotReject(import("../../../src/lib/types.js"));
  });
});
