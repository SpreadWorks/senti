import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SkillManifest } from "../../../src/lib/skill-manifest.js";

function skillContent(name, description = "A useful skill.") {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# Skill\n`;
}

describe("SkillManifest", () => {
  it("accepts a dot-namespaced skill with hyphen-case segments", () => {
    const manifest = SkillManifest.parse(skillContent("sennel.flow-auto"), {
      directoryName: "sennel.flow-auto",
      sourcePath: "/skills/sennel.flow-auto/SKILL.md",
    });

    assert.equal(manifest.name, "sennel.flow-auto");
  });

  it("accepts an unnamespaced hyphen-case skill", () => {
    const manifest = SkillManifest.parse(skillContent("custom-flow"), {
      directoryName: "custom-flow",
    });

    assert.equal(manifest.name, "custom-flow");
  });

  for (const name of ["sennel..flow", ".sennel", "sennel.", "sennel.Flow", "sennel_flow"]) {
    it(`rejects invalid skill name ${name}`, () => {
      assert.throws(
        () => SkillManifest.parse(skillContent(name), { directoryName: name }),
        /invalid skill name/,
      );
    });
  }

  it("rejects a manifest name that differs from its source directory", () => {
    assert.throws(
      () => SkillManifest.parse(skillContent("sennel.flow"), { directoryName: "sennel.other" }),
      /does not match source directory/,
    );
  });

  it("ignores host-specific frontmatter fields outside the discovery contract", () => {
    const content = "---\nname: sennel.flow\ndescription: A useful skill.\nhost-extension: value\n---\n";
    const manifest = SkillManifest.parse(content, { directoryName: "sennel.flow" });
    assert.equal(manifest.name, "sennel.flow");
  });

  it("supports folded multiline descriptions", () => {
    const content = "---\nname: sennel.flow\ndescription: >-\n  Run the Flow dispatcher\n  through completion.\n---\n";
    const manifest = SkillManifest.parse(content, { directoryName: "sennel.flow" });
    assert.equal(manifest.description, "Run the Flow dispatcher through completion.");
  });
});
