## Background

retro's static evaluation relies on two independent mappings: keys in test-map.json (R1, R2, ...) and test name prefixes in TAP output (`^R\d+\b`). test-map.json is a declaration file hand-written by AI, and consistency with test code is not guaranteed. In practice, with spec 248, the R4:/R5: prefixes were missing from it() names, causing retro to drop to 60%.

## Approach

Deprecate test-map.json and declare requirement coverage in a comment header at the top of test files.

```
# spec: R1 R2 R4 R5
```

### Changes

1. Introduce a convention to write `# spec: R1 R2 ...` headers at the top of test files
2. Static check on write-tests step completion: read test file headers and verify that all requirements in spec.json are covered by at least one file
3. Refactor retro's `tryStaticEvaluation`: obtain test file → requirement mapping from headers instead of test-map.json
4. Change review-test's untested requirement warnings to also be header-based
5. Remove test-map.json read/write logic (req-map.js)
6. Move the "not testable" flag to requirement definitions in spec.json (`"testable": false`)

### Relationship with extractReqResults' `^(R\d+)\b` approach

TAP output R-ID extraction (extractReqResults) is not deprecated. The header is a file-level declaration of "which requirements this file covers," while extractReqResults is a test-level judgment of "which requirement each individual test verifies." Having both allows detection of cases where a file declares R4 but has no it() starting with R4:.

### Language-agnostic

Since headers are string patterns in comment lines, they are language-independent. Combined with dcb2 (test runner externalization), static evaluation becomes possible even for non-Node.js projects.

<details>
<summary>ja</summary>

[ENHANCE] test-map.json を廃止し、テストファイルヘッダー宣言 (# spec: R1 R2 ...) に一本化

## 背景

retro の static 評価は test-map.json のキー (R1, R2, ...) と TAP 出力のテスト名プレフィックス (^R\d+\b) の 2 つの独立したマッピングに依存している。test-map.json は AI が手書きする宣言ファイルで、テストコードとの整合性は保証されない。実際に spec 248 で it() 名に R4:/R5: プレフィックスが欠落し、retro が 60% になる事象が発生した。

## 方針

test-map.json を廃止し、テストファイル先頭のコメントヘッダーで要件カバレッジを宣言する。

```
# spec: R1 R2 R4 R5
```

### 変更点

1. テストファイル先頭に `# spec: R1 R2 ...` ヘッダーを記述する規約を導入
2. write-tests ステップ完了時に静的チェック: テストファイルのヘッダーを読み、spec.json の全要件が少なくとも 1 ファイルでカバーされているか検証
3. retro の tryStaticEvaluation を改修: test-map.json ではなくヘッダーからテストファイル→要件の対応を取得
4. review-test の未テスト要件警告も同様にヘッダーベースに変更
5. test-map.json の読み込み・保存ロジック (req-map.js) を削除
6. テスト不要フラグは spec.json の要件定義に移動 (`"testable": false`)

### extractReqResults の ^(R\d+)\b 方式との関係

TAP 出力からの R-ID 抽出 (extractReqResults) は廃止しない。ヘッダーは「このファイルはどの要件をカバーするか」のファイルレベル宣言、extractReqResults は「個々のテストがどの要件を検証したか」のテストレベル判定。両方あることで、ファイルが R4 を宣言しているのに R4: で始まる it() が無い場合を検出できる。

### 言語非依存

ヘッダーはコメント行の文字列パターンなので言語を問わない。dcb2 (テストランナー外部化) と組み合わせることで、非 Node.js プロジェクトでも static 評価が可能になる。

</details>