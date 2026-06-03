/**
 * src/lib/agent-defaults.js
 *
 * Default agent providers and profiles seeded by `setup` and merged (add-only)
 * by `upgrade`. The content is generic: model tiers plus sdd-forge command ids
 * only — no project/environment-specific values (no hostnames, ports, etc.), so
 * it is safe to ship in the package per the src/ project-info rule.
 *
 * Single source of truth: callers do not import the raw constants. They call
 * `mergeAgentDefaults(agent)`, which adds only what is missing and never
 * overwrites existing user values. Providers are derived from the profiles —
 * only providers actually referenced by the resulting profiles are added.
 */

// Provider pool: only providers referenced by the default profiles below.
// (codex/gpt-5.3 is intentionally absent — no default profile references it.)
const PROVIDER_POOL = {
  "claude/sonnet": {
    command: "claude",
    args: ["-p", "{{PROMPT}}", "--model", "sonnet", "--output-format", "json"],
    systemPromptFlag: "--system-prompt",
    jsonOutputFlag: "--output-format json",
  },
  "claude/opus": {
    command: "claude",
    args: ["-p", "{{PROMPT}}", "--model", "opus", "--output-format", "json"],
    systemPromptFlag: "--system-prompt",
    jsonOutputFlag: "--output-format json",
  },
  "claude/haiku": {
    command: "claude",
    args: ["-p", "{{PROMPT}}", "--model", "haiku", "--output-format", "json"],
    systemPromptFlag: "--system-prompt",
    jsonOutputFlag: "--output-format json",
  },
  "codex/gpt-5.5": {
    command: "codex",
    args: ["exec", "--json", "--sandbox", "workspace-write", "-m", "gpt-5.5", "-C", ".tmp", "{{PROMPT}}"],
    jsonOutputFlag: "--json",
  },
  "codex/gpt-5.4": {
    command: "codex",
    args: ["exec", "--json", "--sandbox", "workspace-write", "-m", "gpt-5.4", "-C", ".tmp", "{{PROMPT}}"],
    jsonOutputFlag: "--json",
  },
  "codex/gpt-5.3-spark": {
    command: "codex",
    args: ["exec", "--json", "--sandbox", "workspace-write", "-m", "gpt-5.3-codex-spark", "-C", ".tmp", "{{PROMPT}}"],
    jsonOutputFlag: "--json",
  },
};

const PROFILES = {
  "claude-main": {
    "docs.init": "claude/sonnet",
    "docs.enrich": "claude/sonnet",
    "docs.text": "claude/sonnet",
    "docs.forge": "claude/sonnet",
    "docs.readme": "claude/sonnet",
    "docs.agents": "claude/haiku",
    "docs.translate": "codex/gpt-5.4",
    "flow.auto-check": "claude/sonnet",
    "flow.spec.gate": "claude/sonnet",
    "flow.spec.review.propose": "codex/gpt-5.5",
    "flow.draft.review.questions.propose": "codex/gpt-5.5",
    "flow.draft.review.coverage.propose": "codex/gpt-5.5",
    "flow.impl.review.propose": "codex/gpt-5.5",
    "flow.impl.review.final": "claude/opus",
    "flow.test.execute": "claude/sonnet",
    "flow.test.result-review": "claude/haiku",
    "flow.test.review": "codex/gpt-5.5",
    "flow.finalize.retro": "claude/haiku",
    "flow.context.search": "claude/haiku",
    "workflow.publish": "claude/sonnet",
  },
  "codex-main": {
    "docs.init": "claude/sonnet",
    "docs.enrich": "claude/sonnet",
    "docs.text": "claude/sonnet",
    "docs.forge": "claude/sonnet",
    "docs.readme": "codex/gpt-5.3-spark",
    "docs.agents": "codex/gpt-5.3-spark",
    "docs.translate": "codex/gpt-5.5",
    "flow.auto-check": "claude/sonnet",
    "flow.spec.gate": "codex/gpt-5.3-spark",
    "flow.spec.review.propose": "claude/opus",
    "flow.draft.review.questions.propose": "claude/opus",
    "flow.draft.review.coverage.propose": "claude/opus",
    "flow.impl.review.propose": "claude/opus",
    "flow.impl.review.final": "claude/opus",
    "flow.test.execute": "claude/sonnet",
    "flow.test.result-review": "codex/gpt-5.3-spark",
    "flow.test.review": "claude/opus",
    "flow.finalize.retro": "codex/gpt-5.3-spark",
    "flow.context.search": "codex/gpt-5.3-spark",
    "workflow.publish": "claude/sonnet",
  },
  "claude-only": {
    docs: "claude/sonnet",
    "docs.agents": "claude/haiku",
    "flow.auto-check": "claude/sonnet",
    "flow.spec.gate": "claude/sonnet",
    "flow.spec.review.propose": "claude/opus",
    "flow.draft.review.questions.propose": "claude/opus",
    "flow.draft.review.coverage.propose": "claude/opus",
    "flow.impl.review.propose": "claude/opus",
    "flow.impl.review.final": "claude/opus",
    "flow.test.execute": "claude/sonnet",
    "flow.test.result-review": "claude/haiku",
    "flow.test.review": "claude/opus",
    "flow.finalize.retro": "claude/haiku",
    "flow.context.search": "claude/haiku",
    "workflow.publish": "claude/sonnet",
  },
  "codex-only": {
    "docs.init": "codex/gpt-5.4",
    "docs.enrich": "codex/gpt-5.4",
    "docs.text": "codex/gpt-5.4",
    "docs.forge": "codex/gpt-5.4",
    "docs.readme": "codex/gpt-5.3-spark",
    "docs.agents": "codex/gpt-5.3-spark",
    "docs.translate": "codex/gpt-5.4",
    "flow.auto-check": "codex/gpt-5.4",
    "flow.spec.gate": "codex/gpt-5.3-spark",
    "flow.spec.review.propose": "codex/gpt-5.5",
    "flow.draft.review.questions.propose": "codex/gpt-5.5",
    "flow.draft.review.coverage.propose": "codex/gpt-5.5",
    "flow.impl.review.propose": "codex/gpt-5.5",
    "flow.impl.review.final": "codex/gpt-5.5",
    "flow.test.execute": "codex/gpt-5.4",
    "flow.test.result-review": "codex/gpt-5.3-spark",
    "flow.test.review": "codex/gpt-5.5",
    "flow.finalize.retro": "codex/gpt-5.3-spark",
    "flow.context.search": "codex/gpt-5.3-spark",
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Default agent profiles (deep clone). */
export function defaultAgentProfiles() {
  return clone(PROFILES);
}

/** Providers referenced by the default profiles (deep clone). */
export function defaultAgentProviders() {
  const referenced = referencedProviderKeys(PROFILES);
  const out = {};
  for (const key of referenced) {
    if (!PROVIDER_POOL[key]) {
      throw new Error(`agent-defaults: default profile references unknown provider "${key}"`);
    }
    out[key] = clone(PROVIDER_POOL[key]);
  }
  return out;
}

function referencedProviderKeys(profiles) {
  const keys = new Set();
  for (const profile of Object.values(profiles)) {
    for (const providerKey of Object.values(profile)) keys.add(providerKey);
  }
  return keys;
}

/**
 * Add-only merge of default profiles and their referenced providers into an
 * agent config object. Existing user values always win:
 *   - existing profile names keep their slots; only missing slots are added.
 *   - existing provider entries are never overwritten.
 *   - only providers referenced by the resulting profiles (and known in the
 *     pool) are added.
 * `default` / `useProfile` are never touched.
 *
 * @param {object} agent - the `config.agent` object (mutated in place)
 * @returns {{changed: boolean, addedProfiles: string[], addedSlots: string[], addedProviders: string[]}}
 */
export function mergeAgentDefaults(agent) {
  if (!agent || typeof agent !== "object") {
    throw new Error("mergeAgentDefaults: agent must be an object");
  }
  if (!agent.profiles || typeof agent.profiles !== "object") agent.profiles = {};
  if (!agent.providers || typeof agent.providers !== "object") agent.providers = {};

  const addedProfiles = [];
  const addedSlots = [];
  const addedProviders = [];

  // 1) Profiles: add missing profiles whole; for existing ones, add missing slots only.
  for (const [name, profile] of Object.entries(PROFILES)) {
    if (!(name in agent.profiles)) {
      agent.profiles[name] = clone(profile);
      addedProfiles.push(name);
      continue;
    }
    const target = agent.profiles[name];
    if (!target || typeof target !== "object") continue;
    for (const [commandId, providerKey] of Object.entries(profile)) {
      if (!(commandId in target)) {
        target[commandId] = providerKey;
        addedSlots.push(`${name}.${commandId}`);
      }
    }
  }

  // 2) Providers: add those referenced by the resulting profiles, known in the
  //    pool, and not already defined by the user.
  const referenced = referencedProviderKeys(agent.profiles);
  for (const key of referenced) {
    if (!(key in agent.providers) && PROVIDER_POOL[key]) {
      agent.providers[key] = clone(PROVIDER_POOL[key]);
      addedProviders.push(key);
    }
  }

  return {
    changed: addedProfiles.length > 0 || addedSlots.length > 0 || addedProviders.length > 0,
    addedProfiles,
    addedSlots,
    addedProviders,
  };
}
