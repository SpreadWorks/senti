#!/usr/bin/env node
import { AlphaReleaseArguments, AlphaReleaseCommand, AlphaReleasePromotion } from "./alpha-release.js";

new AlphaReleaseCommand({
  label: "alpha-release-promote",
  execute: () => {
    const argumentsList = new AlphaReleaseArguments(process.argv.slice(2), { requiresVersion: true });
    return new AlphaReleasePromotion().promote(argumentsList.intent, argumentsList.version);
  },
  render: (version) => `Promoted sennel@${version} to the latest dist-tag.`,
}).run();
