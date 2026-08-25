#!/usr/bin/env node
import { AlphaReleaseCommand, AlphaReleasePackInspector } from "./alpha-release.js";

new AlphaReleaseCommand({
  label: "alpha-release-pack",
  execute: () => new AlphaReleasePackInspector().inspect(),
  render: (inspection) => `Alpha release pack inspection passed for ${inspection.invariant.version}.\n\nPublishable files:\n${inspection.files.map((file) => file.toDisplayLine()).join("\n")}\n\nConfirmation proof: ${inspection.proof}\n\n${inspection.confirmationInstructions()}`,
}).run();
