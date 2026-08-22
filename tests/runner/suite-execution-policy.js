const DEFAULTS = Object.freeze({ unit: 4, integration: 2, e2e: 2, acceptance: 1, agent: 1 });

export class TestSuiteExecutionPolicy {
  constructor({ jobs = null } = {}) {
    if (jobs !== null && (!Number.isInteger(jobs) || ![1, 2].includes(jobs))) throw new Error("test jobs must be 1 or 2");
    this.jobs = jobs;
  }
  concurrencyFor(suite) {
    if (!(suite in DEFAULTS)) throw new Error(`unknown test suite: ${suite}`);
    return this.jobs ?? DEFAULTS[suite];
  }
}
