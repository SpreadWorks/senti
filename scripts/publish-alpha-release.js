#!/usr/bin/env node
import { AlphaReleaseArguments, AlphaReleaseCommand, AlphaReleasePublisher } from "./alpha-release.js";

new AlphaReleaseCommand({
  label: "alpha-release-publish",
  execute: () => {
    const argumentsList = new AlphaReleaseArguments(process.argv.slice(2), { requiresPackProof: true });
    return new AlphaReleasePublisher().publish(argumentsList.intent, argumentsList.packProof);
  },
  render: (invariant) => `Published ${invariant.version} with the alpha dist-tag.`,
}).run();
