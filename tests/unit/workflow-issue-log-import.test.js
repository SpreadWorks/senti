import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCandidates } from "../../src/workflow/lib/commands/issue-log-import.js";

describe("workflow issue-log-import candidates", () => {
  it("skips raw diagnostic entries that lack decision-ready board material", () => {
    const { candidates, skipped } = buildCandidates([
      {
        step: "draft-gate",
        level: "parent",
        reason: "draft approval is required",
        trigger: "gate post hook (auto)",
        observations: [
          {
            kind: "violation",
            observed: "draft approval is required",
            severity: "blocking",
          },
        ],
      },
      {
        step: "impl-gate",
        reason: "impl-gate failed before AI evaluation because file-map.json was missing",
        trigger: "senti flow run gate returned ARTIFACT_PLACEHOLDER file-map.json missing",
        resolution: "record requirement-to-file mappings with senti flow set files before rerunning gate",
        guardrailCandidate: "record file-map before impl-gate when implementation touches production files",
        timestamp: "2026-06-03T03:03:47.647Z",
      },
    ], { sourceLang: "ja" });

    assert.equal(skipped, 1);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].source.step, "impl-gate");
  });

  it("formats Japanese candidates with target, cause, improvement direction, and board reason", () => {
    const { candidates } = buildCandidates([
      {
        step: "spec-review",
        reason: "spec review provider returned JSON missing blockingFindings and nonBlockingImprovements fields",
        trigger: "senti flow run review --phase spec failed schema validation after provider retries",
        resolution: "recorded tooling failure and retrying the same review step with unchanged spec evidence",
        guardrailCandidate: "review provider outputs must include required structured fields before parsing",
        timestamp: "2026-06-03T02:40:30.557Z",
      },
    ], { sourceLang: "ja" });

    assert.equal(candidates.length, 1);
    assert.match(candidates[0].title, /^\[BUG\] spec-review provider が必須 field を含む JSON を返せない$/);
    assert.match(candidates[0].body, /## 対象\nstep: spec-review/);
    assert.match(candidates[0].body, /## 問題\nspec-review provider が必須 field を含む JSON を返せない。/);
    assert.match(candidates[0].body, /観測内容: spec review provider returned JSON missing/);
    assert.match(candidates[0].body, /## 原因\n次の実行結果から確認できる。/);
    assert.match(candidates[0].body, /根拠: senti flow run review --phase spec failed schema validation/);
    assert.match(candidates[0].body, /## 改善方向\n次の再発防止策を検討する。/);
    assert.match(candidates[0].body, /review provider outputs must include required structured fields before parsing/);
    assert.match(candidates[0].body, /現在の対応: recorded tooling failure/);
    assert.match(candidates[0].body, /## ボード化する理由\n再発防止のための guardrail \/ 手順改善候補として記録されている。/);
  });

  it("reports omitted only for eligible candidates over the cap", () => {
    const entry = (step) => ({
      step,
      reason: `${step} failed because an artifact was missing`,
      trigger: "gate returned missing artifact",
      resolution: "record the artifact before rerunning gate",
    });

    const { candidates, omitted, skipped } = buildCandidates([
      { step: "raw", reason: "raw observation only", trigger: "gate post hook", observations: [{}] },
      entry("first"),
      entry("second"),
    ], { max: 1, sourceLang: "en" });

    assert.equal(candidates.length, 1);
    assert.equal(omitted, 1);
    assert.equal(skipped, 1);
  });
});
