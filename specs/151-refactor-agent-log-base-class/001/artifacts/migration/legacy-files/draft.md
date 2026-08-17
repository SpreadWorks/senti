# Draft: AgentLog ログ基盤リファクタリング（Log 基底クラス導入）

**開発種別:** リファクタリング
**目的:** callAgent 内部に密結合しているログ処理を分離し、汎用ログ基盤（Log 基底クラス + logger 関数）を導入することで、関心の分離と将来の拡張性を確保する。

## Q&A

### 1. Goal & Scope — ゴールは明確か？スコープは限定されているか？

**Q:** このリファクタリングのゴールと完了条件は何か？

**A:** ゴールは3つ:
1. `callAgent` / `callAgentAsync` からログ処理の責務を除去する（agentLog, cfg 引数の削除）
2. 汎用 Log 基底クラスと `logger` 関数を `src/lib/log.js` に新規作成する
3. AgentLog を Log の継承クラスに変更し、呼び出し元でログ制御を行うパターンに移行する

スコープ外: GitLog 等の新しいログ種別の実装、ログフォーマットの変更、resolveLogDir のロジック変更。

### 2. Impact on existing — 既存のコード・機能・テストへの影響は？

**Q:** どのファイルが影響を受けるか？既存動作は変わるか？

**A:** 影響範囲:
- `src/lib/agent.js` — callAgent / callAgentAsync の末尾2引数（agentLog, cfg）を削除。現状すべての呼び出し元がデフォルト値 null で呼んでいるため、動作への影響はない。
- `src/lib/agent-log.js` — AgentLog を Log 継承に変更。appendAgentLog と resolveLogDir を `src/lib/log.js` に移動。
- flow 系4ファイル（review.js, run-gate.js, run-retro.js, get-context.js）— 12箇所の callAgent 呼び出し。引数削除のみ。ログ追加は今回のスコープでは任意。
- docs 系7ファイル — 各1箇所の callAgent/callAgentAsync 呼び出し。引数削除のみ。

**既存動作への影響:** 現状 agentLog=null で全箇所が呼ばれており、ログは実質未使用。引数を削除しても外部動作は変わらない。

### 3. Constraints — 非機能要件、ガードレール、プロジェクトルールは？

**Q:** 守るべき制約は？

**A:**
- 外部依存禁止（Node.js 組み込みモジュールのみ）— Log/logger も fs, path のみ使用
- `src/` にプロジェクト固有情報を含めない — ログ基盤は汎用設計
- alpha 版ポリシー — 後方互換コードは書かない。旧 appendAgentLog は削除してよい
- CLI インターフェースの後方互換性 — 今回は内部 API のみの変更で CLI に影響なし

### 4. Edge cases — 境界条件、エラーケースは？

**Q:** logger が失敗した場合の挙動は？

**A:** 現行の appendAgentLog と同じポリシーを維持する: ログ書き込みの失敗は stderr に出力し、例外を throw しない。ログはベストエフォートであり、本体処理を止めてはならない。

**Q:** isEnabled が false の場合は？

**A:** logger は即座に return する。ファイルシステム操作は行わない。

### 5. Test strategy — 何をどうテストするか？

**Q:** テスト方針は？

**A:**
- Log 基底クラスのユニットテスト（toJSON, isEnabled のデフォルト動作、static filename）
- logger 関数のユニットテスト（isEnabled=false 時のスキップ、正常書き込み、エラー時の silent failure）
- AgentLog の既存 toJSON テストは維持
- agent.js のテストがあれば、agentLog/cfg 引数削除に合わせて更新

### 6. Alternatives considered — 他のアプローチは検討したか？

**Q:** なぜ呼び出し元にログ責務を移すのか？callAgent 内部にログを残すアプローチは？

**A:** callAgent 内部に残す案は関心の分離を達成できない。callAgent はエージェント呼び出しに専念すべきであり、ログの有無・種別・書き込み先の判断を持つべきではない。呼び出し元に移すことで、flow 系はフロー文脈（spec/phase）を持つログを、docs 系はログなしまたは汎用ログを、それぞれ独立に制御できる。

### 7. Future extensibility — この変更は将来の修正・拡張にどう影響するか？

**Q:** Log 基底クラスを導入することで、将来どう拡張できるか？

**A:** 新しいログ種別（例: GitLog, MetricLog）を追加する場合、Log を継承して `static filename`、`isEnabled`、`toJSON` を実装するだけでよい。logger 関数は共通で使える。呼び出し元の try/finally パターンも統一される。

## Open Questions

なし。Issue #103 に十分な設計情報が含まれている。

- [x] User approved this draft (autoApprove)
- Approved: 2026-04-06
