# Feature Specification: 347-bind-mandatory-repair-evidence

**Feature Branch**: `feature/347-bind-mandatory-repair-evidence`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #467

## Goal
mandatory finding の繰返しによる自動 defer を禁止し、repair evidence の fingerprint、reviewed tree、repair diff、validating test result を現在の finding と評価対象へ一致させる。

## Background
現行 policy は requirement または blocking guardrail に紐付く mandatory finding を must-fix とするが、repeatCount が maxOccurrences に達すると DeferredDisposition を返し requiresRepair を解除する。さらに repair evidence は同じ normalized finding id と scope、時刻以後の file/commit を確認するだけで、レビューした tree、実際の repair diff、検証済み test result を結び付けない。authoritative finding の fingerprint は source location と root cause を区別しない経路があり、別 finding が同じ repair status を共有し得る。

## Scope
- src/flow/lib/finding-disposition-policy.js の mandatory disposition、finding identity、repair evidence validation
- finding disposition policy の shared regression tests と spec-local behavior coverage

## Out of Scope
- #422 で導入した disposition class の export 名・全体モデルの再設計
- non-mandatory finding の disposition policy 変更
- src/flow/commands/review.js、src/flow/lib/run-gate.js、flow command definition、hook、config entry、focused finding-disposition test 以外の test suite の変更

## Constraints
- Node.js built-in modules のみを使い、外部依存を追加しない。
- ReviewFindingFingerprint、FindingDispositionPolicy、RepairEvidenceReference の既存 type surface を保持し、値の invariant は各専用 class の constructor と method で強制する。
- gate は evidence.findingFingerprint が finding.fingerprint、evidence.reviewedTree が evaluated target tree、evidence.repairDiff が current repair diff、evidence.validatingTestResult が同じ finding/tree を検証した pass result の各値に一致しない場合に evidence を拒否する。
- 変更対象は finding disposition policy と focused finding-disposition tests に限定する。

## Design Principles
- mandatory authority は repeatCount より優先し、明示的な decision または検証済み repair evidence だけが blocking 状態を解除できる。
- repair evidence は finding fingerprint、reviewed tree、repair diff、validating test result の四値を保存し、gate は各値を current finding と evaluated target state の対応値へ個別に一致比較する。
- finding fingerprint は location と root cause を含む canonical identity から計算し、異なる finding の repair status 共有を防ぐ。

## Overview
### Modules
- src/flow/lib/finding-disposition-policy.js: mandatory/informational disposition、finding fingerprint、repair evidence reference、gate decision を所有する。
- tests/unit/flow/finding-disposition-policy.test.js: existing public policy contract の shared regression を検証する。
- specs/347-bind-mandatory-repair-evidence/tests/finding-disposition-policy.test.js: R1-R6 の spec-local behavior coverage を所有する。
- FindingDispositionPolicy preserves MustFixDisposition for mandatory findings regardless of recurrence count.
- ReviewFindingFingerprint derives canonical identity from location and rootCause in addition to requirement, guardrail, and file.
- RepairEvidenceReference validates exact finding fingerprint, reviewed tree and HEAD, repair diff, and validating test result before gate use.
- Spec-local and shared finding-disposition tests cover the R1-R7 policy contract.

### Data Flow
- review finding + requirement/guardrail authority → canonical fingerprint → disposition classification → mandatory gate block または explicit decision / fully bound repair evidence → gate decision
- repair evidence claim → fingerprint/tree/diff/test-result の各値を current finding と evaluated target state に比較 → scope match → gate pass eligibility
- mandatory authority and repeat count -> MustFixDisposition -> repair-required gate path
- review finding identity fields -> normalized canonical tuple -> distinct SHA-256 fingerprint
- repair evidence claim -> typed validation -> exact target-state comparison -> matching repair evidence or mandatory gate block
- policy inputs and repair evidence variants -> focused regression assertions -> requirement evidence

### Decisions
- [VERIFY] mandatory authority を持つ finding は maxOccurrences 到達時に DeferredDisposition へ変換されるため、自動 defer を除去して MustFixDisposition を維持する。
- [VERIFY] existing repair evidence は normalizedFindingId、scope、timestamp、file/commit materialization だけを照合するため、finding fingerprint、current tree、repair diff、validating test result の一致比較を追加する。
- [VERIFY] authoritative finding identity は file を含むが source location と root cause text を除外し得るため、canonical identity に両方を含めて distinct finding を分離する。
- Migration parity: flow run review は disposition/fingerprint/repeatCount artifact を生成し続け、flow run gate は同じ artifact と issue-log evidence を消費し続ける。owner は FindingDispositionPolicy、ReviewFindingFingerprint、RepairEvidenceReference のままで、変更は evidence acceptance 条件だけである。
- Mandatory recurrence never creates an implicit defer; only explicit gate dispositions can unblock without repair evidence.
- Location and root cause are semantic identity fields, so findings that differ in either field cannot share repair evidence.
- Malformed, incomplete, stale, or mismatched evidence is ignored rather than weakening a mandatory finding.
- Spec-local coverage complements the shared suite so issue-specific requirements remain executable and traceable.

## Clarifications (Q&A)
- Q: 既存の explicit allow/defer decision はどう扱うか。
  - A: 既存の明示的 decision 経路は維持する。repeatCount は explicit decision を生成せず、repair requirement を暗黙に解除しない。
- Q: evidence validation failure 時に artifact をどう扱うか。
  - A: 無効な evidence claim は repair evidence として採用せず、gate を blocking に保つ。無関係な flow artifact の削除や command/hook/config の変更は行わない。

## Alternatives Considered
- mandatory finding を recurrence cap で DeferredDisposition にし続ける。 — 修復または明示判断なしに must-fix finding が non-blocking となり、#467 の gate contract に反するため採用しない。
- file existence と mtime を repair evidence の十分条件として残す。 — 別 finding、古い tree、touched-only file を current repair と誤認でき、fingerprint/tree/diff/test-result の四値比較要件を満たさないため採用しない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T14:30:37.205Z
- Notes: auto: preflight accepted by user; draft, spec review, and gates passed.

## Requirements
- R1 [must]: mandatory requirement または blocking guardrail に紐付く finding は、repeatCount が maxOccurrences 以上でも MustFixDisposition と requiresRepair=true を維持する。
- R2 [must]: mandatory finding が gate を pass できるのは、evidence.findingFingerprint、evidence.reviewedTree、evidence.repairDiff、evidence.validatingTestResult の各値が current finding と evaluated target state に一致する場合、または既存の明示的 allow/defer decision が適用される場合だけとする。
- R3 [must]: repair evidence は finding fingerprint、reviewed HEAD/tree、repair diff、validating test result を必須の検証対象として保持し、gate は四値のそれぞれが current finding と evaluated target state に一致する場合だけ evidence を受け入れる。
- R4 [must]: repair evidence が unrelated、stale、touched-only、fingerprint/tree/diff/test-result mismatch のいずれかである場合、gate はその evidence を拒否し mandatory finding を blocking のままにする。
- R5 [must]: ReviewFindingFingerprint は canonical identity に finding location と root cause を含め、同じ requirement/guardrail/file でも location または root cause が異なる finding を別 fingerprint として追跡する。
- R6 [should]: non-mandatory finding は既存どおり InformationalDisposition となり、repair loop に入らない。
- R7 [must]: spec-local と shared policy tests は R1-R6 の mandatory recurrence、explicit decision、repair evidence binding/rejection、identity separation、non-mandatory regression を検証する。

## Acceptance Criteria
- A mandatory R1 finding at repeatCount=maxOccurrences is a MustFixDisposition with requiresRepair=true and blocks the gate without accepted evidence or explicit decision.
- A gate accepts repair evidence only when its fingerprint, reviewed tree, repair diff, and validating test result match the current mandatory finding and review state.
- Unrelated, stale, touched-only, or any bound-value-mismatched evidence does not unblock a mandatory finding.
- Two findings that differ by location or root cause receive different fingerprints and cannot share repair evidence or repair status.
- A non-mandatory finding remains InformationalDisposition with requiresRepair=false.
- specs/347-bind-mandatory-repair-evidence/tests/finding-disposition-policy.test.js contains the canonical // spec: R1 R2 R3 R4 R5 R6 R7 header, and the focused shared policy test suite passes.

## Implementation Targets
- src/flow/lib/finding-disposition-policy.js
- tests/unit/flow/finding-disposition-policy.test.js
- specs/347-bind-mandatory-repair-evidence/tests/finding-disposition-policy.test.js (// spec: R1 R2 R3 R4 R5 R6 R7)

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Preserve mandatory blocking
  - mandatory authority を持つ finding が recurrence cap に達しても must-fix のまま gate-blocking となる policy を実装する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Separate finding identity
  - finding location と root cause を canonical identity に含め、distinct finding が fingerprint と repair status を共有しないようにする。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Bind repair evidence
  - repair evidence の fingerprint、reviewed tree、repair diff、validating test result を current finding と evaluated target state に個別比較し、不一致 evidence を gate が受理しないようにする。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Cover disposition policy
  - #467 の policy contract を spec-local coverage と focused shared regression に記録する。
  - see `tasks/T-4.md` for full spec
