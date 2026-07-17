import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TokenMetricsInput,
  TokenMetricsInputFingerprint,
} from "../../../src/metrics/commands/token.js";

describe("TokenMetricsInputFingerprint", () => {
  const alpha = new TokenMetricsInput("001-alpha/flow.json", '{"value":1}\n');
  const beta = new TokenMetricsInput("002-beta/flow.json", '{"value":2}\n');

  it("is independent of file enumeration order", () => {
    const forward = TokenMetricsInputFingerprint.from([alpha, beta]);
    const reverse = TokenMetricsInputFingerprint.from([beta, alpha]);

    assert.equal(forward.value, reverse.value);
    assert.equal(forward.inputCount, 2);
  });

  it("changes for content and file-set changes", () => {
    const baseline = TokenMetricsInputFingerprint.from([alpha, beta]);
    const oneByteChange = TokenMetricsInputFingerprint.from([
      new TokenMetricsInput("001-alpha/flow.json", '{"value":0}\n'),
      beta,
    ]);
    const deletion = TokenMetricsInputFingerprint.from([alpha]);
    const addition = TokenMetricsInputFingerprint.from([
      alpha,
      beta,
      new TokenMetricsInput("003-gamma/flow.json", '{"value":3}\n'),
    ]);

    assert.notEqual(oneByteChange.value, baseline.value);
    assert.notEqual(deletion.value, baseline.value);
    assert.notEqual(addition.value, baseline.value);
  });

  it("is stable for an unchanged empty input set", () => {
    assert.equal(
      TokenMetricsInputFingerprint.from([]).value,
      TokenMetricsInputFingerprint.from([]).value,
    );
  });
});
