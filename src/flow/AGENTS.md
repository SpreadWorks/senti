# Flow 状態遷移アーキテクチャ

このドキュメントを Flow 状態遷移の責務境界、不変条件、検証要件の正本とする。`src/flow/` と、Flow の状態遷移に関係する `src/lib/flow-manager.js`、`src/lib/flow-version.js`、および対応するテストに適用し、上位の `src/AGENTS.md` と併せて従うこと。

## 状態遷移方針の所有者

- **MUST:** 永続化された現在状態と観測済みの事実から disposition、Step lifecycle、次の遷移先を決める責務は definition layer が単独で所有する。現在の中心は `definition.js` とし、意味のある facts、disposition、transition plan は専用クラスで表現する。
- **MUST:** retry、retry exhaustion、repair、defer、block、external block、Step status、次の route の選択を、実行コマンド、registry、状態読取り、`get-next-action` に重複実装しない。
- command の返却値に含まれる `next` や成果物内の `nextAction` は、必要であれば互換用の投影値として保持できるが、遷移判断の権限として使用してはならない。

## 実行と永続化

- `run-*` コマンドは、選択済み Action の実行、外部出力の境界検証、観測事実の保存を担う。semantic result から retry 回数、上限、repair、次の route を独自に決めてはならない。
- transport、protocol、tooling failure の限定的な再試行は実行責務に含めてよい。ただし semantic retry budget と Flow の遷移方針は definition layer が所有する。
- registry、hook、永続化層は、definition layer が選んだ transition plan の原子的な適用と監査記録を担う。未選択の fallback route を決めてはならない。
- 直接 CLI 実行にも admission check を設け、最新の永続状態で definition layer が別の Action を選んでいる場合は worker 起動と状態変更の前に拒否する。

## 状態と証拠の同一性

- **MUST:** canonical store を唯一の状態 authority とする。singleton、process memory、呼出し元が保持する古いオブジェクトを、遷移判断の正としてはならない。
- command boundary と dispatcher の再検証では最新状態を再読込みする。読取り処理は状態、成果物、時刻を変更してはならない。
- 判断に使う成果物は current Attempt の ID と sequence、および catalog publication と一致しなければならない。source artifact、canonical artifact、repair evidence、finding は lineage または fingerprint で同じ revision に結び付ける。
- Action identity と fingerprint には永続化済みの安定値だけを使う。`now()` のように読取りごとに変わる fallback を含めてはならない。必要な値がない場合は、安定した unavailable 状態として扱うか、安全側で拒否する。
- transition plan の適用層は、definition layer が選んだ方針だけを適用する。適用時に別の遷移を再判断してはならない。

## `get-next-action` の責務

`get-next-action` は次の順序だけを担う。

1. 最新の canonical state と必要な canonical artifacts を読む。
2. definition layer に facts を渡して transition plan を得る。
3. 選択済み route 固有の前提条件を検証する。
4. transition plan を CLI の Action directive に投影する。

成果物の PASS、REJECTED、retry count、repair evidence などを独自に解釈し、definition layer と競合する遷移を選んではならない。

## 必須の検証

状態遷移を追加または移行する変更では、影響する範囲に応じて次を検証する。

- facts と disposition の状態表、および各 disposition から transition plan への対応
- stale context、旧 Attempt、Attempt sequence 不一致、source/canonical lineage 不一致
- semantic retry、tooling failure、retry exhaustion、部分完了、復旧、再ロード、冪等な再取得
- definition layer が別の route を選んだ状態で直接コマンドを呼び、worker、Activity、状態に副作用がないこと
- canonical state と artifacts の局所的な fixture から definition layer の判断、transition plan、Action 投影、適用結果を決定論的に検証すること。検証のために Flow、dispatcher、worker、agent を起動しない

既存テストが表す正当なシナリオを弱めて変更を通してはならない。

## Gate 移行中の一時例外

Gate には、この規約より前から `run-gate.js`、registry、`get-next-action` に分散した遷移判断が存在する。Gate を phase 単位で移行する期間に限り、未移行 phase の既存判断経路を一時的に残してよい。

- 未移行経路に新しい遷移方針を追加してはならない。
- 移行対象 phase では、先に必要な振る舞いを facts、disposition、transition plan の状態表として確定し、その契約を局所的な決定論的テストで固定する。現行経路がこの規約または確定した契約と矛盾する場合、旧挙動との一致を正しさの基準にしてはならない。
- phase の移行完了時に、その phase の旧判断を `run-gate.js`、registry、`get-next-action` から除去する。
- 未移行 phase を目的なく整理、統合、削除してはならない。
- 全 Gate phase の移行後、旧判断経路を除去する最終タスクでこの一時例外も削除し、実装済みの最終責務境界に更新する。

この責務境界から外れる必要がある場合は、例外をコード内だけに作らず、設計上の理由と維持する不変条件を同じ変更でこの文書に反映する。
