## Fix Strategy

1. Relax draft-scope-boundary (include the answer field in carve-out / remove draft from the applicable phases, etc. — specifics to be finalized in spec)
2. Add a carve-out to spec-synthesize-not-copy as well (policy corrections based on code contradictions should be treated as corrections, not inventions)
3. Add a step to the spec-phase prompt: "Cross-reference the implementation policy raised in draft against the relevant source code to verify its validity; if contradictions are found, confirm with the user before correcting"
4. Incorporate a user-confirmation procedure into flow / prompt for cases where the draft policy is changed during spec

## Background

draft-scope-boundary triggers a fix → another location surfaces → re-fail loop because of the structure where "the AI cites different example Qs each time for the same guardrail."

All existing defense mechanisms assume "same id AND same reason," so they do not work in this case where the reason string differs on every occurrence:
- flip override: activates only on exact headSha + worktreeHash match → invalidated when the hash changes after a fix
- assertNoRepeatedFail: escalates only on exact (guardrail_id, reason) match → passes through because the reason is different each time
- previouslyPassedIds injection: ids that are continuously failing never get added to the list

Real examples: gate-draft ×5 in spec 252, gate-draft ×7 in spec 249, etc.

The original rationale for creating draft-scope-boundary was "there is a risk of proceeding with an incorrect implementation policy if draft finalizes it without investigating the sources." By moving the safeguard to the spec phase, this concern can still be covered by spec's verification step even after draft is relaxed.

## Derived Discussion Points (expected to be handled as separate tasks)

spec-test-coverage / prioritize-requirements / complete-context have the same whack-a-mole structure (failure counts across the last 30 specs: 22 / 18 / 11 respectively).

If structural countermeasures such as "have the reviewer enumerate all violations at once" emerge from this issue, they can be applied horizontally.

<details>
<summary>ja</summary>

[ENHANCE] draft-scope-boundary もぐら叩きループ対策（保険を spec へ移譲）

## 修正方針

1. draft-scope-boundary を緩和（answer フィールドも carve-out に含める / phase から draft を外す等、具体策は spec で詰める）
2. spec-synthesize-not-copy にも carve-out を追加（コード矛盾に基づく方針修正は invent ではなく correction とみなす）
3. spec フェーズの prompt に「draft で挙げられた実装方針を該当ソースコードに突き合わせて妥当性を確認し、矛盾があればユーザーに確認の上で修正する」step を追加
4. spec で draft 方針を変更した場合のユーザー確認手順を flow / prompt に組み込む

## 背景

draft-scope-boundary が「同一 guardrail で AI が毎回違う Q を例示として cite する」構造のため、修正 → 別箇所が浮上 → 再 fail のループが発生する。

既存の防御機構はいずれも「同一 id かつ同一 reason」前提のため、reason 文字列が毎回異なるこのケースには効かない:
- flip override: headSha + worktreeHash 完全一致時のみ発動 → 修正でハッシュが変わると無効
- assertNoRepeatedFail: (guardrail_id, reason) 完全一致時のみエスカレーション → reason が毎回別物で素通り
- previouslyPassedIds 注入: 連続 fail している id はリストに入らない

実例: 252 spec の gate-draft x5、249 spec の gate-draft x7 など。

元々 draft-scope-boundary を作った理由は「ソース未調査のまま draft で実装方針を確定すると間違いのまま進むリスクがある」だった。保険を spec フェーズに移すことで、draft を緩和してもこの懸念は spec の検証 step でカバーできる。

## 派生論点（別タスク扱い想定）

spec-test-coverage / prioritize-requirements / complete-context も同型のもぐら叩き構造を持つ（直近 30 spec の失敗回数: それぞれ 22 / 18 / 11）。

本件で「reviewer に違反全数列挙させる」等の構造側対策が見えれば横展開可能。

</details>