# Spec 229: Forest-Aware Safety-Net Fallback — Tests

## What was tested
- REQ-1: safety-net fallback が forest DFS 順でタスクを promote すること
- REQ-2: promote されたタスクの先頭 pending ステップが in_progress になること
- REQ-3: 正常パス（in_progress ステップあり）では fallback が発動しないこと

## Location
`specs/229-forest-aware-safety-net/tests/safety-net-forest-aware.test.js`

## How to run
```bash
node --test specs/229-forest-aware-safety-net/tests/safety-net-forest-aware.test.js
```

## Expected results
- 4 tests, all passing after implementation
- Forest structure test: T-child-1 (DFS-first) が T-root-2 (array-first) より先に promote される
- Flat list test: 配列順で正しいタスクが promote される（DFS は flat リストで配列順と等価）
