import { getAcceptanceFixtureDir } from "../acceptance/lib/targets.js";
import { copyFixture, removeTmpDir, runPipeline } from "../acceptance/lib/pipeline.js";
import { createSchemaAwareStubProvider, createStubAgent } from "../helpers/stub-agent.js";

export async function runStubAcceptance({
  fixtureName = "base",
  getAcceptanceFixtureDir: fixtureFor = getAcceptanceFixtureDir,
  copyFixture: copy = copyFixture,
  createProvider = createSchemaAwareStubProvider,
  runPipeline: pipeline = runPipeline,
  verifyQuality = (provider) => provider.quality(),
} = {}) {
  const fixture = fixtureFor(fixtureName);
  const tmp = copy(fixture, { type: "base" });
  const provider = createProvider();
  try {
    const result = pipeline === runPipeline
      ? await pipeline(tmp, { agent: createStubAgent(provider) })
      : await pipeline(tmp, provider);
    return { ...result, quality: verifyQuality(provider) };
  } finally {
    if (copy === copyFixture) removeTmpDir(tmp);
  }
}

export function createStubPipeline(provider) {
  return (tmp) => runPipeline(tmp, { agent: createStubAgent(provider) });
}
