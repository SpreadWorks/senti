#!/usr/bin/env node
import { AlphaReleaseCommand, AlphaReleaseVerifier } from "./alpha-release.js";

new AlphaReleaseCommand({
  label: "alpha-release-verify",
  execute: () => new AlphaReleaseVerifier().verify(),
  render: () => "Alpha release verification passed.",
}).run();
