export function resolveAcceptanceRun(discovery, requested) {
  if (discovery.error) throw new Error(`acceptance discovery failed: ${discovery.error.code}`);
  if (discovery.targets.length === 0) throw new Error("no acceptance targets found");
  const targets = requested.length === 0
    ? discovery.targets
    : requested.map((name) => {
      const target = discovery.targets.find((candidate) => candidate.name === name);
      if (!target) throw new Error(`unknown acceptance target: ${name}`);
      return target;
    });
  if (targets.length === 0 || targets.some((target) => !target.testFile)) throw new Error("no executable acceptance targets found");
  return targets.map((target) => target.testFile);
}

export function runAcceptanceTargets({ requested = [], discoverTargets, executeTests, writeError }) {
  try {
    const files = resolveAcceptanceRun(discoverTargets(), requested);
    executeTests(files);
    return 0;
  } catch (error) {
    writeError(`${error.message}\n`);
    return 1;
  }
}
