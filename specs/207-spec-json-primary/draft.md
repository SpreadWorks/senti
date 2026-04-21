# Draft: spec.json → primary switch (core wiring replacement)

**開発種別:** refactor / enhance（cac6 分解タスク T8）

**目的:** `spec.md` を真実の出所から外し、`spec.json` を core wiring の読み込み元に切り替える。`spec.md` は `sdd-forge spec render` による派生物として位置づける。

## Background

cac6 親計画のタスク 8/11。T1 (#181) で `spec.json` schema と `spec render` コマンドが整備済み。T2 (#183) で flow.json の tasks 拡張が入った。T1 成果物の `specs/196-spec-json-schema-render/interface.md` に、spec.md を読み書きする全箇所とその置換方針が整理されており、本タスクはその方針を実装に落とす。alpha ポリシーのため旧経路は削除する。

## Scope

### In
- core wiring（flow ランタイム / docs 生成 / metrics が spec 内容を読む経路）で、spec.md の regex 解析を spec.json の構造化読み込みに置換する。
- 対象の consumer が spec から必要とする情報（goal / scope / requirements / 承認状態 / 認可されたテスト変更リスト 等）を構造化データとして spec.json から取得する経路を整備する。
- spec.md は `spec render` による派生物に統一し、prepare / review 書き換え / finalize 直前の 3 タイミングで自動再生成されること。
- flow.json が保持する spec ポインタの扱いを変更する（`.md` ではなく spec ディレクトリ / `.json` を指すよう統一）。

### Out
- 既存 `specs/*/spec.md` から `spec.json` への一括マイグレーション（T11 のスクリプトが担当）。
- `tests/<spec>/spec.md`（test design ドキュメント。feature spec とは別物）。
- `spec render` コマンド仕様そのものの変更。
- `spec.schema.json` の version 機構導入。
- guardrail 3-tier 構造変更（T3 の責務）。

## Impact on Existing Features

- 既存テストフィクスチャで `specs/NNN-xxx/spec.md` を直書きしているものは、`spec.json` + render による生成に置換する必要が出る（gate / retro / review / merge / prepare-spec を検証するテスト）。
- active flow 中に spec.md を手動編集する運用は壊れる。編集元は spec.json に一本化する。
- `specs/*/spec.md` しか持たない旧形式 spec は、T11 マイグレーション未実行の状態では動作しない。merge 順序は「T11 → T8」または「T11 と本タスクを同時 merge」とする。
- CLI の `--spec <path>` オプションの受け付け範囲が広がる（`.md` / `.json` / ディレクトリのいずれでも正規化）。既存スクリプトは非破壊で継続動作する。

## Requirements

### Priority 1: Must（T8 成立の必須要件）

- **R1 [must]**: When core wiring が spec の構造化フィールド（goal, scope, requirements, clarifications, acceptance_criteria, alternatives_considered, open_questions, constraints, design_principles, overview, background, 認可されたテスト変更リスト、実装ターゲット）を必要とする場合, the system shall read them from spec.json via a single load path that schema-validates the input.
- **R2 [must]**: When `spec.json` が存在しない or schema validation に失敗した場合, core wiring shall non-zero exit code と stderr への理由メッセージ出力で停止すること（fallback で旧 spec.md を読まない）。
- **R3 [must]**: When flow prepare によって新しい spec が作成される場合, the system shall prepare 完了前に最小構成の spec.json を生成し、かつ同じ prepare 内で `spec render` を呼んで spec.md を派生生成すること。
- **R4 [must]**: When gate / review / retro / merge / finalize / changelog / forge / metrics のいずれかのコマンドが実行される場合, the system shall spec.md の直接 regex 解析ではなく spec.json から構造化データを取得すること。
- **R5 [must]**: When flow.json の spec ポインタが参照される場合, the path shall 新しい規約（spec ディレクトリ または `spec.json`）で正規化されること。

### Priority 2: Must（非退行）

- **R6 [must]**: When 既存テストスイート（`npm test`）が実行される場合, all suites shall pass。spec.md 直読前提のフィクスチャは spec.json ベースに更新されていること。
- **R7 [must]**: When `sdd-forge spec render` が決定論的に動作する T1 の invariant が保持されていること（同一 spec.json から同一 spec.md を生成）。

### Priority 3: Should（品質）

- **R8 [should]**: When spec.json の load / validate を複数箇所で行う場合, the system shall 共通の load path を共有し、spec.json に関する I/O を 1 モジュールに集約すること（DRY）。
- **R9 [should]**: When core wiring が spec.json を読んだ結果を返す場合, consumer は plain object を受け取り、呼び出し側でフィールドアクセスできること（OOP クラス化は別 spec）。

### Priority 4: Nice-to-have

- **R10 [nice-to-have]**: When `--spec <path>` に `.md` / `.json` / directory のいずれを渡しても, the CLI shall 同一の挙動で動作すること（移行期の運用容易性）。

## Constraints

- 外部依存なし（Node.js 組み込みモジュールのみ）。
- alpha ポリシー: 後方互換コードを書かない。旧 spec.md 直読経路は削除する。
- 内部インターフェースは信頼し、バリデーションはシステム境界（CLI 入力 / schema 検証）でのみ行う。
- テストコードをテスト合格のために弄らない。テスト失敗時はまずシナリオの妥当性を確認する。

## Design Principles

1. **spec.md はビュー、spec.json はモデル**: MVC のモデル層を spec.json に集約。spec.md は決定論的レンダラ出力。
2. **I/O 集約**: spec.json の load + schema validate は 1 箇所に閉じる（DRY）。
3. **承認状態の所在**: 承認は flow state（step 管理）で表現し、spec 本体に持たない。spec は仕様、flow は進行状態という関心の分離。
4. **構造化データ優先**: spec の内容を consumer が必要とするなら、regex parse ではなく schema フィールドとして扱う。parse 不要化で情報損失がゼロになる。

## Q&A

**Decision Mode**: 以下の Q&A は全て **最終判断（Decision）** として記録する。ブレインストーミング（未確定の探索）ではない。Issue 本文と specs/196/interface.md（T1 成果物）で既に方針が提示されており、user が [1] で承認済みの入力を起点としている。将来の再検討が必要な項目は Open Questions に分離する。

### Q1: 対象スコープは core wiring のみでよいか
- **Recommendation**: はい。templates / locale の文字列は単なるファイル名参照であり、移行対象外。
- **基準**: 既存コード調査結果（interface.md、T1 成果物）と user 選択 [1]。
- **A**: 採用。

### Q2: `## Authorized Existing Test Modifications` セクションの扱い
- **Recommendation**: spec.schema.json に optional 配列フィールドを追加し spec.json に持たせる。renderer は従来通りのセクションとして spec.md に出力。core wiring は spec.json から直接取得する。
- **基準**: guardrail「Unambiguous Requirements」+ interface.md の指摘「structured fields 化が T8 の本質目的」。
- **A**: 採用。

### Q3: `## User Confirmation` checkbox（`- [x] User approved this spec`）への依存
- **Recommendation**: spec.json には持たせず、flow state の approval step で判定する。renderer は `## User Confirmation` を固定出力し人間可読性を維持。
- **基準**: design principle 3（承認は flow の進行状態）+ 現行 flow に approval step が既にある。
- **A**: 採用。

### Q4: 既存 `specs/*/spec.md` のみの古い spec は動作するか
- **Recommendation**: No。T11 マイグレーション前提で運用する。merge order は「T11 → T8」または「両者同時 merge」。
- **基準**: alpha ポリシー（後方互換を取らない）。
- **A**: 採用。

### Q5: flow.json の spec ポインタ値の移行
- **Recommendation**: ポインタは spec ディレクトリ（`specs/NNN-xxx/`）または spec.json を指すよう変更。移行期は `.md` 値の自動正規化を許容する（alpha であっても既存 active flow を壊さない範囲のランタイム補正は OK）。
- **基準**: 変更時点の active flow が prepare 直後のみ存在する可能性が高く、壊さない方が摩擦が少ない。
- **A**: 採用。

## Alternatives Considered

- spec.md 直読を残し spec.json を追加入力として併用する案: alpha ポリシー違反。gate / review の二重化で複雑化。却下。
- Q2 で spec.json 拡張せず、専用 JSON ファイルを分離する案: I/O が分散し consumer ごとに load 実装が増える。却下。
- Q3 で spec.json に `user_confirmation` フィールドを追加する案: 進行状態と仕様の関心を混在させる。却下。

## Acceptance Criteria

- spec.json が存在する active flow で、gate / review / retro / merge / finalize / changelog / forge / metrics の各コマンドが spec.md を直接 regex parse せずに動作する。
- `spec.md` の手動変更は `spec render` によって上書きされる（spec.json が真のソース）。
- 既存テストスイートが回帰なく pass する。
- `spec.json` が無い active flow を実行した際、明示的なエラーが出る（silent fallback しない）。
- `spec.schema.json` に認可テスト変更リストのフィールドが追加されており、schema 検証が通る。

## Test Strategy

- **ユニット**: spec.json load + schema validate の happy / エラー（不在、構造違反）パス。認可テスト変更リストフィールドの validation。
- **統合**: 各 core wiring コマンドを spec.json ベースフィクスチャで呼び、期待挙動を検証。
- **回帰**: 既存 `npm test` をグリーン維持。spec.md 直読前提テストは spec.json ベースに置換。
- **e2e**: prepare → gate → approval → implement → gate-impl → finalize を spec.json ベースで通す。

## Future Extensibility

- `SpecDocument` クラス化（OOP 表現）は振る舞いが必要になった時点で別 spec。
- `spec render` のテンプレート切替（multilingual, 異なる formatter）は本 spec では扱わない。
- spec.json の version 機構は将来追加。

## Open Questions

- なし（Q1-Q5 で合意確定）。

## User Confirmation

- [x] User approved this draft (auto mode: Issue #201 + specs/196/interface.md の T8 方針を既定の入力として採用)
- Confirmed at: 2026-04-21
- Notes: 大きな設計判断（schema 拡張 / flow.json spec 変更 / approval 参照切替）は Q&A に記録。
