#!/usr/bin/env node
import { AlphaReleaseCommand, AlphaReleaseValidator } from "./alpha-release.js";

new AlphaReleaseCommand({
  label: "alpha-version",
  execute: () => new AlphaReleaseValidator().validate(),
  render: (invariant) => `Alpha version valid: ${invariant.version} (HEAD commits: ${invariant.commitCount.value})`,
}).run();
