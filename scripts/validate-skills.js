#!/usr/bin/env node

import { MAIN_SKILLS_DIR, validateSkillsFromDir } from "../src/lib/skills.js";
import { enabledPluginSkillSourceDirs } from "../src/lib/plugin-registry.js";

try {
  const sourceDirs = [MAIN_SKILLS_DIR, ...enabledPluginSkillSourceDirs(process.cwd())];
  const manifests = sourceDirs.flatMap((skillsDir) => validateSkillsFromDir(skillsDir));
  for (const manifest of manifests) {
    console.log(`valid skill: ${manifest.name}`);
  }
  console.log(`${manifests.length} skill manifests valid`);
} catch (error) {
  console.error(`skill validation failed: ${error.message}`);
  process.exitCode = 1;
}
