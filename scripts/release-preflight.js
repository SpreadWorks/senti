#!/usr/bin/env node
import { AlphaReleaseCommand, AlphaReleasePreflight } from "./alpha-release.js";

new AlphaReleaseCommand({
  label: "release-preflight",
  execute: () => new AlphaReleasePreflight().run(),
  render: (invariant) => `Release preflight passed: ${invariant.version} matches HEAD commit count`,
}).run();
