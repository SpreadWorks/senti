const FAILURE_CODE_FOR_REASON = Object.freeze({
  inactivity: "FLOW_TEST_REVIEW_REPAIR_WORKER_INACTIVITY_TIMEOUT",
  maximum_lifetime: "FLOW_TEST_REVIEW_REPAIR_WORKER_MAXIMUM_LIFETIME_TIMEOUT",
  provider_timeout: "FLOW_TEST_REVIEW_REPAIR_WORKER_PROVIDER_TIMEOUT",
});

/** Canonical identity for one test-review repair worker timeout. */
export class TestReviewRepairWorkerTimeout {
  constructor(reason) {
    if (!Object.hasOwn(FAILURE_CODE_FOR_REASON, reason)) {
      throw new Error(`invalid test-review repair worker timeout reason: ${reason}`);
    }
    this.reason = reason;
    this.failureCode = FAILURE_CODE_FOR_REASON[reason];
    Object.freeze(this);
  }

  static fromAgentFailure(error) {
    const reason = Object.hasOwn(FAILURE_CODE_FOR_REASON, error?.timeoutReason)
      ? error.timeoutReason
      : "provider_timeout";
    return new TestReviewRepairWorkerTimeout(reason);
  }

  static isFailureCode(value) {
    return Object.values(FAILURE_CODE_FOR_REASON).includes(value);
  }
}
