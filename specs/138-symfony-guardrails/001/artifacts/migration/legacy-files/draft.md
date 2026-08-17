# Draft: 138-symfony-guardrails

**Created**: 2026-04-04
**Status**: Approved
**Issue**: #83
**Development Type**: enhancement（機能追加）

## Goal

**目的:** Symfony プリセットにフレームワーク固有の guardrail を追加し、SDD フローの spec/impl/review フェーズで Symfony ベストプラクティスが自動適用されるようにする。また、coding-rule プリセットに汎用コード品質ルールを2件追加し、review フェーズを guardrail システムで有効化する。

## Q&A

- Q: 既存の Symfony guardrail（4件）との重複はどう扱うか？
  - A: 重複する2件（#1 service, #4 voter）は除外。残りは既存と補完関係にあるため追加する。

- Q: Symfony 固有でない汎用ルール（厳密比較、早期リターン等）はどこに置くか？
  - A: coding-rule プリセットに配置する。このスコープに含める。

- Q: UX 系 guardrail（Stimulus/Turbo/LiveComponent 等）は使っていないプロジェクトで誤誘導しないか？
  - A: body に「〜を使用するプロジェクトの場合:」を条件前置して回避する。全10件を Symfony プリセットに入れる。

- Q: review フェーズの guardrail はシステムで処理できるか？
  - A: phases.js の VALID_PHASES に review を追加すれば動作する。このスコープに含める。

- Q: 元コンテンツのライセンスは？
  - A: 3ソースすべて MIT。コピーはせず独自の文章で再記述し、NOTICE に inspired by として出典を記載する。

## Background

3つの外部ソース（awesome-copilot, symfony-ux-skills, EasyAdminBundle AGENTS.md）からインスピレーションを得て、独自の文章で guardrail を作成する。元コンテンツのコピーはしない。

## Decisions

### D1: 既存 guardrail との重複除外
- #1（コントローラにビジネスロジックを置かない）→ 除外。既存 `service` と重複
- #4（複雑な認可は Voter）→ 除外。既存 `voter` と重複

### D2: Symfony 固有でない汎用ルールの配置先
- #30（厳密比較のみ）→ coding-rule プリセットに追加
- #31（return/throw 後の else 禁止）→ coding-rule プリセットに追加
- #29, #32-34, #36（Yoda 条件式、例外メッセージ書式、コメント規約、CSS ルール）→ 除外。プロジェクト固有 or 汎用性不足
- #33（サイレント catch 禁止）→ 除外。base `no-silent-error-swallowing` でカバー済み

### D3: UX 系 guardrail の条件前置
- UX 系 10件（#19-28）は全て Symfony プリセットに入れる
- body に「〜を使用するプロジェクトの場合:」を前置し、未使用プロジェクトでの誤誘導を回避

### D4: review フェーズの有効化
- `src/flow/lib/phases.js` の `VALID_PHASES` に `"review"` を追加
- guardrail.json の phase に `"review"` を指定可能にする
- impl と重複する内容は `phase: ["impl", "review"]` で1記事に統合

## Deliverables

| ファイル | 変更内容 |
|---------|---------|
| `src/presets/symfony/templates/ja/guardrail.json` | 既存4件 + 新規34件 |
| `src/presets/symfony/templates/en/guardrail.json` | 同上（英語版） |
| `src/presets/coding-rule/templates/ja/guardrail.json` | 既存3件 + 新規2件 |
| `src/presets/coding-rule/templates/en/guardrail.json` | 同上（英語版） |
| `src/presets/symfony/NOTICE` | 出典3件の謝辞 |
| `src/flow/lib/phases.js` | VALID_PHASES に review 追加 |

## Priority

全件実装が前提（guardrail は部分適用しない）。実装順序の優先度:
1. **P1: phases.js の review 追加** — 他の guardrail が review フェーズを使うための前提
2. **P2: Symfony guardrail 34件** — 本タスクの主目的。spec → impl → review の順に追加
3. **P3: coding-rule guardrail 2件** — 汎用ルール。Symfony と独立して追加可能
4. **P4: NOTICE ファイル** — 実装完了後に追加

## Guardrail Inventory (Symfony: 34 new items)

各 guardrail は「条件（When/If）→ 制約（shall/shall not）」の形式で body を記述する。

### spec phase (7 items)

| id | title | body (When → shall) |
|----|-------|---------------------|
| no-bundle-for-app-code | Bundle 禁止 | アプリケーションコードを追加する場合: Bundle にせず、デフォルトの Symfony ディレクトリ構造（config/, src/, templates/）を使い PHP ネームスペースで整理すること。 |
| env-vars-for-infra-only | 環境変数はインフラ設定のみ | 設定方法を決定する場合: 環境変数はインフラ設定（DB接続、外部API URL等）のみに使用し、アプリケーション挙動の制御には config/services.yaml のパラメータ（app. 接頭辞）を使うこと。 |
| use-messenger-for-async | 非同期は Messenger | 非同期・バックグラウンド処理を設計する場合: Symfony Messenger を使用し、failure transport を必ず設定すること。 |
| ux-package-selection-criteria | UX パッケージ選択基準 | Symfony UX を採用しているプロジェクトでフロントエンド実装を設計する場合: 静的コンポーネント→TwigComponent、JS動作付き→Stimulus、リアクティブ→LiveComponent、部分更新→Turbo Frame、マルチターゲットDOM操作→Turbo Stream、リアルタイム→Mercure+Turbo Stream の基準で選択すること。 |
| live-component-performance-design | LiveComponent パフォーマンス設計 | Symfony UX LiveComponent を使用するプロジェクトの場合: 不要な再レンダリングを避ける設計を spec 段階で検討し、LiveProp の粒度・デバウンス・defer/lazy の適用箇所を明示すること。 |
| stable-public-interfaces | 公開インターフェースの安定性 | 公開インターフェース（Contracts/ 等）を変更する場合: 安定 API として扱い、破壊的変更は慎重に判断すること。 |
| use-enums-for-fixed-values | 固定値は enum | 固定値の集合を定義する場合: 定数ではなく PHP 8.1 の enum で表現すること（case 名は UpperCamelCase）。 |

### impl phase (19 items)

| id | title | body (When → shall) |
|----|-------|---------------------|
| constructor-injection-only | コンストラクタインジェクションのみ | サービスを利用する場合: コンストラクタインジェクションのみを使用し、$container->get() によるサービス取得を禁止する。autowiring + autoconfiguration をデフォルトとし、サービスは private にすること。 |
| forms-as-php-classes | フォームは PHP クラス定義 | フォームを作成する場合: PHP クラスとして定義し、コントローラ内で直接ビルドしないこと。ボタンはテンプレートに配置し、バリデーション制約は対象オブジェクトに定義すること。 |
| avoid-raw-filter | \|raw 禁止 | Twig テンプレートを記述する場合: \|raw フィルタは信頼済みかつサニタイズ済みコンテンツにのみ使用し、デフォルトのエスケープを無効化しないこと。 |
| snake-case-templates | テンプレート命名は snake_case | テンプレートを作成する場合: テンプレート名・ディレクトリ名・変数名はすべて snake_case とし、フラグメントにはアンダースコア接頭辞（_partial.html.twig）を付けること。 |
| key-based-translations | 翻訳はキーベース | 翻訳を実装する場合: リテラル文字列ではなく目的を表すキーを使用し、翻訳ファイルは XLIFF 形式とすること。 |
| doctrine-attribute-mapping | Doctrine マッピングは PHP 属性 | Doctrine エンティティを定義する場合: XML/YAML マッピングではなく PHP 属性（#[ORM\Entity] 等）を使用すること。 |
| schema-changes-via-migrations | スキーマ変更はマイグレーション経由 | データベーススキーマを変更する場合: 直接操作を禁止し、Doctrine Migrations を使用すること。 |
| use-asset-mapper | Web アセットは AssetMapper | Web アセットを管理する場合: AssetMapper を使用し、不要なフロントエンドビルドの複雑性を導入しないこと。 |
| single-firewall-preferred | ファイアウォール単一構成 | セキュリティ設定を構成する場合: 複数システムが必要な場合を除き単一ファイアウォールとし、パスワードハッシャーは auto を使用すること。 |
| stimulus-controller-name-match | Stimulus コントローラ名一致 | Stimulus を使用するプロジェクトの場合: コントローラファイル名（kebab-case）と HTML の data-controller 属性値が一致していることを確認すること。命名ミスマッチは最多バグ原因。 |
| stimulus-no-dom-assumption-on-connect | Stimulus connect() で DOM 前提にしない | Stimulus を使用するプロジェクトの場合: connect() 時に DOM 要素の存在を前提にせず、要素の存在チェックまたは適切なライフサイクルフックを使うこと。 |
| turbo-frame-id-match | Turbo Frame id 一致 | Turbo を使用するプロジェクトの場合: Frame の id がサーバーレスポンスの \<turbo-frame id\> と一致しなければならない。不一致は無言で失敗する。 |
| turbo-cache-js-reinit | Turbo キャッシュ復元時の JS 再初期化 | Turbo を使用するプロジェクトの場合: Turbo Drive のキャッシュ復元時に Stimulus controller の connect() が再実行されないケースを考慮すること。 |
| turbo-stream-redirect-loss | Turbo Stream リダイレクト消失 | Turbo を使用するプロジェクトの場合: フォーム送信後のリダイレクトで Turbo Stream レスポンスが消えるケースを考慮すること。 |
| twig-component-prop-leak | TwigComponent props 漏れ | TwigComponent を使用するプロジェクトの場合: ExposeInTemplate を適切に制御し、不要な props が HTML 属性に出力されないようにすること。 |
| live-prop-required-for-state | LiveProp 必須 | LiveComponent を使用するプロジェクトの場合: 状態を保持したいプロパティには必ず LiveProp 属性を付けること。LiveProp でないプロパティは再レンダリング時にリセットされる。 |
| live-prop-no-complex-objects | LiveProp に複雑オブジェクト禁止 | LiveComponent を使用するプロジェクトの場合: LiveProp にはスカラー値またはシンプルな DTO のみを使用し、複雑なオブジェクトを渡さないこと。ハイドレーションエラーの原因になる。 |
| ux-icons-lock-before-deploy | UX Icons ロック | UX Icons を使用するプロジェクトの場合: 本番デプロイ前に ux:icons:lock を実行し、Iconify API 依存を排除すること。 |
| ux-map-height-required | UX Map height 必須 | UX Map を使用するプロジェクトの場合: マップコンテナに必ず明示的な CSS height を設定すること。未指定だと 0px に潰れる。 |

### impl+review phase (3 items)

| id | title | body (When → shall) |
|----|-------|---------------------|
| no-container-get | $container->get() 禁止 | サービスを利用する場合: $container->get() によるサービスロケータパターンの使用を禁止する。コンストラクタインジェクションを使うこと。 |
| no-direct-form-building-in-controller | コントローラ内フォーム直接ビルド禁止 | フォームを作成する場合: $this->createFormBuilder() 等のコントローラ内直接ビルドを禁止し、フォーム PHP クラスを使うこと。 |
| trans-filter-required | \|trans 必須 | ユーザー向けテキストを表示する場合: テンプレート内のすべてのユーザー向け文字列に \|trans フィルタを適用すること。ハードコード禁止。 |

### review-only phase (5 items)

| id | title | body (When → shall) |
|----|-------|---------------------|
| detect-raw-filter-usage | \|raw 使用検出 | レビュー時: Twig テンプレート内の \|raw フィルタの使用箇所を検出し、XSS リスクの正当性を確認すること。 |
| detect-stimulus-name-mismatch | Stimulus 名不一致検出 | Stimulus を使用するプロジェクトのレビュー時: HTML の data-controller 属性値と controllers/ 配下のファイル名の対応を検証すること。 |
| detect-turbo-frame-id-mismatch | turbo-frame id 不一致検出 | Turbo を使用するプロジェクトのレビュー時: リクエスト元とレスポンスの turbo-frame id 一致を検証すること。 |
| detect-live-prop-state-dependency | LiveProp なし状態依存検出 | LiveComponent を使用するプロジェクトのレビュー時: LiveProp 属性のないプロパティに状態を保持しているパターンを検出すること。 |
| verify-ux-icons-lock | ux:icons:lock 実行確認 | UX Icons を使用するプロジェクトのレビュー時: デプロイ設定に ux:icons:lock が含まれているか検証すること。 |

## Guardrail Inventory (coding-rule: 2 new items)

| id | title | body (When → shall) |
|----|-------|---------------------|
| strict-comparison-only | 厳密比較のみ | 比較演算を行う場合: === と !== のみを使用し、== と != を禁止すること。 |
| no-else-after-return | return/throw 後の else 禁止 | 条件分岐を記述する場合: return または throw の後に else/elseif を書かず、早期リターンパターンでネストを浅くすること。 |

- [x] User approved this draft
- Approved at: 2026-04-04
