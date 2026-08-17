# Clarification Q&A

- Q: どの DataSource ファイルに重複パースロジックが存在するか？
  - A: 3つのプリセット（laravel, symfony, cakephp2）で `parse()` メソッドと `analyze*()` 関数の間にほぼ同一のパースロジックが重複している。具体的には:
    - **laravel/data/controllers.js**: `parse()` と `parseControllerScan()` が同じ classMatch, actions, diDeps, middleware 抽出を重複実装
    - **laravel/data/models.js**: `parse()` と `parseModelScan()` が同じ classMatch, tableName, fillable, guarded, casts, hidden, relations, scopes, accessors 抽出を重複実装
    - **symfony/data/controllers.js**: `parse()` と `parseControllerFile()` が同じ classMatch, actions(with attributes), diDeps 抽出を重複実装
    - **symfony/data/entities.js**: `parse()` と `parseEntityFile()` が同じ classMatch, tableName, repositoryClass, columns, relations 抽出を重複実装
    - **cakephp2/data/models.js**: `parse()` と `analyzeModels()` 内のループ本体が同じ classMatch, extractStringProperty, relations, validate, actsAs 抽出を重複実装

- Q: `analyze*()` 関数の用途は何か？
  - A: `analyze*()` は directory-level analyzer として scan 機構以前からの legacy コード。現在はテスト (`tests/`) から参照される。これらは `findFiles()` でディレクトリを走査し、各ファイルに対してパースロジックを適用する。`parse()` は Scannable mixin の scan パイプラインから1ファイルずつ呼ばれる。

- Q: 抽出すべき共有ヘルパーのスコープは？
  - A: 各プリセットの parse ロジックはフレームワーク固有であるため、プリセットごとに「1ファイルをパースして素の結果オブジェクトを返す」プライベートヘルパー関数を抽出する。`parse()` も `analyze*()` もこのヘルパーを呼ぶ形にする。クロスプリセットの汎用ヘルパーは不要（PHP class match は php-array-parser に既にある）。

- Q: webapp 親の `parse()` も重複しているか？
  - A: webapp/data/controllers.js と webapp/data/models.js は `parseFile()` (scanner.js) を使う汎用的な parse。子プリセットが FW 固有パースで override しているため、親の parse は重複の対象外。

## Confirmation
- Before implementation, ask the user:
  - "この仕様で実装して問題ないですか？"
- If approved, update `spec.md` -> `## User Confirmation` with checked state.
