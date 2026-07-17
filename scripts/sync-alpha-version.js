#!/usr/bin/env node
import { AlphaReleaseCommand, AlphaReleaseSynchronizer } from "./alpha-release.js";

new AlphaReleaseCommand({
  label: "alpha-version-sync",
  execute: () => new AlphaReleaseSynchronizer().synchronize(),
  render: (result) => result.status === "updated"
    ? `Updated package.json to ${result.version}. Commit only that file as the final release commit, then run npm run release:preflight.`
    : `Alpha version already synchronized: ${result.version}`,
}).run();
