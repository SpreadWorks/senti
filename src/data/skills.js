/**
 * SkillsSource — DataSource adapter for the bundled skill-rules SSOT.
 *
 * Registers under preset `base`, source `skills`. Method `rule(_, _, params)`
 * returns a `Paragraph` containing the body markdown of the rule whose id is
 * given. Throws on unknown or missing id.
 */

import { loadRules } from "../lib/skill-rules.js";

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const Paragraph = container.get("base.Paragraph");

  let cache = null;
  function rules() {
    if (!cache) cache = loadRules();
    return cache;
  }

  class SkillsSource extends DataSource {
    rule(_analysis, _labels, params) {
      const id = params?.id;
      if (typeof id !== "string" || !id) {
        throw new Error("missing skill rule id (expected params.id)");
      }
      const found = rules().find((r) => r.id === id);
      if (!found) {
        throw new Error(`unknown skill rule id "${id}"`);
      }
      return new Paragraph(found.body.replace(/\n+$/, ""));
    }
  }

  return SkillsSource;
}
