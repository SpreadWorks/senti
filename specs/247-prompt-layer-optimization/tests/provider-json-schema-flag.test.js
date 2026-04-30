import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Provider jsonSchemaFlag", () => {
  async function loadProviders() {
    return import("../../../src/lib/provider.js");
  }

  it("Provider base returns null", async () => {
    const { Provider } = await loadProviders();
    const p = new Provider();
    assert.strictEqual(p.jsonSchemaFlag(), null);
  });

  it("ClaudeProvider returns '--json-schema'", async () => {
    const { ClaudeProvider } = await loadProviders();
    const p = new ClaudeProvider();
    assert.strictEqual(p.jsonSchemaFlag(), "--json-schema");
  });

  it("CodexProvider returns '--output-schema'", async () => {
    const { CodexProvider } = await loadProviders();
    const p = new CodexProvider();
    assert.strictEqual(p.jsonSchemaFlag(), "--output-schema");
  });

  it("UserProvider returns profile.jsonSchemaFlag when set", async () => {
    const mod = await loadProviders();
    const p = new mod.ProviderRegistry({}).resolveProfile("claude/sonnet");
    const userProvider = new (class extends mod.Provider {
      constructor() { super(); this._profile = { jsonSchemaFlag: "--custom-flag" }; }
      jsonSchemaFlag() { return this._profile.jsonSchemaFlag || null; }
    })();
    assert.strictEqual(userProvider.jsonSchemaFlag(), "--custom-flag");
  });

  it("UserProvider returns null when profile.jsonSchemaFlag not set", async () => {
    const mod = await loadProviders();
    const userProvider = new (class extends mod.Provider {
      constructor() { super(); this._profile = {}; }
      jsonSchemaFlag() { return this._profile.jsonSchemaFlag || null; }
    })();
    assert.strictEqual(userProvider.jsonSchemaFlag(), null);
  });
});
