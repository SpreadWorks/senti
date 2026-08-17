# Draft: fix-upgrade-exp-skill-path

**開発種別:** バグ修正
**目的:** `sdd-forge upgrade` で experimental スキル（`sdd-forge.exp.workflow`）がインストールされないバグを修正する

## 背景

`upgrade.js:91` で experimental スキルのテンプレートパスを `root`（プロジェクトルート）基準で解決しているが、テンプレートは sdd-forge パッケージ内に存在する。そのため `deployProjectSkills` に渡されるパスが誤りとなり、テンプレートが見つからずスキルがデプロイされない。

## 影響範囲

- **影響あり**: `src/upgrade.js:91` の `expDir` パス解決のみ
- **影響なし**:
  - `deploySkills`（通常スキル）— 内部で `PKG_DIR` 基準の `MAIN_SKILLS_TEMPLATES_DIR` を使用しており正常
  - 他の `path.join(root, ...templates...)` パターン — `.sdd-forge/templates/` へのプロジェクトローカル参照であり正常

## 要件

- experimental スキルのテンプレートパスは、プロジェクトルートではなく sdd-forge パッケージディレクトリを基準に解決されること
- 通常スキルのデプロイ（`deploySkills`）の動作に影響を与えないこと

## テスト戦略

- `specs/<spec>/tests/` に spec テストを配置
- `expDir` が PKG_DIR 基準で正しく解決され、ディレクトリが実在することを検証

## Q&A

1. **影響範囲は upgrade.js:91 のみか？** → はい。`deploySkills` は内部で PKG_DIR を使用、他の root 基準パスはプロジェクトローカルテンプレート参照で正常。
2. **修正方針は Issue の提案通りでよいか？** → はい。PKG_DIR を import し expDir を PKG_DIR 基準に変更する。
3. **テスト方針は？** → spec テストでパス解決の正しさを検証する。

- [x] User approved this draft
