# Draft: Fix catastrophic backtracking in Symfony scan regex

## Problem

`methodBlockRegex` in both `controllers.js` and `routes.js` uses nested quantifiers `((?:...)*)*` that cause catastrophic backtracking when `public function` is not found after many `#[...]` attributes.

Reproduced: 20 `#[Route(...)]` attributes without a following `public function` causes infinite hang.

## Root Cause

```js
/((?:\s*#\[(?:[^\[\]]|\[[^\]]*\])*\]\s*)*)\s*public\s+function\s+(\w+)\s*\(/g
```

The `((?:...)*)*` pattern: outer `*` tries different ways to split attribute sequences across the inner `*`, causing exponential backtracking on failure.

## Fix Approach

Replace the single monolithic regex with a two-step approach:
1. Find `public function (\w+)\s*\(` positions first
2. Walk backwards from each match to collect `#[...]` attribute lines

This eliminates nested quantifiers entirely.

## Affected Files

- `src/presets/symfony/scan/controllers.js` (L46)
- `src/presets/symfony/scan/routes.js` (L172)

- [x] User approved this draft (2026-03-20)
