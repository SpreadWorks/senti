/**
 * senti/lib/types.js
 *
 * JSDoc 型定義。
 */

// ---------------------------------------------------------------------------
// JSDoc 型定義
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} DocumentStyle
 * @property {string} purpose   - "developer-guide" | "user-guide" | "api-reference" | 自由文字列
 * @property {string} tone      - "polite" | "formal" | "casual"
 * @property {string} [customInstruction] - 任意の追加指示
 */

/**
 * @typedef {Object} PreamblePattern
 * @property {string} pattern - 正規表現パターン
 * @property {string} [flags] - 正規表現フラグ
 */

/**
 * @typedef {Object} AgentProvider
 * @property {string} name       - 表示名
 * @property {string} command    - 実行コマンド
 * @property {string[]} args     - コマンド引数（{{PROMPT}} プレースホルダー対応）
 * @property {number} [timeout]  - タイムアウト (秒)
 * @property {string} [systemPromptFlag] - system prompt フラグ (例: "--system-prompt", "--system-prompt-file")
 * @property {string} [jsonSchemaFlag] - JSON schema フラグ (例: "--json-schema", "--output-schema")
 * @property {"file"|"inline"} [jsonSchemaMode] - schema 渡し方式 ("file": ファイルパス, "inline": インライン JSON)
 */

/**
 * @typedef {Object} DocsConfig
 * @property {string[]} languages            - Output languages (e.g. ["ja"], ["en", "ja"])
 * @property {string}   defaultLanguage      - Default output language
 * @property {"translate"|"generate"} [mode] - How non-default languages are produced
 * @property {DocumentStyle} [style]         - Document style settings
 * (enrichBatchSize/enrichBatchLines removed — replaced by agent.batchTokenLimit)
 */

/**
 * @typedef {Object} FlowPushConfig
 * @property {string} [remote] - Push remote name (default: "origin")
 */

/**
 * @typedef {Object} FlowConfig
 * @property {string} [merge] - Merge strategy: "squash" | "ff-only" | "merge" (default: "squash")
 * @property {FlowPushConfig} [push] - Push configuration
 */

/**
 * @typedef {Object} CommandsConfig
 * @property {"enable"|"disable"} [gh] - GitHub CLI availability (default: "disable")
 */

/**
 * @typedef {Object} TestConfig
 * @property {string} [command] - Root project regression command parsed as argv-style tokens.
 * @property {string[]} [projectPaths] - Root-relative POSIX project-level test file paths or directory prefixes.
 * @property {number} [timeout] - Project regression timeout in seconds.
 * @property {"targeted"|"full"|"skip"} [testExecuteRegression] - Normal test-execute project regression policy.
 */

/**
 * @typedef {Object} AgentConfig
 * @property {string} [default]              - Default agent provider name
 * @property {string} [workDir]              - Working directory for agent execution
 * @property {number} [timeout]              - Agent execution timeout in seconds
 * @property {number} [retryCount]           - Retry count for docs enrich agent calls
 * @property {Object<string, AgentProvider>} [providers] - Agent provider definitions
 * @property {Object<string, Object<string, string>>} [profiles] - Named profiles mapping commandId prefixes to provider keys
 */

/**
 * @typedef {Object} LogsConfig
 * @property {boolean} [enabled] - Enable unified JSONL logging (default: false)
 * @property {string}  [dir]     - Log output directory (default: {agent.workDir}/logs)
 */

/**
 * @typedef {Object} WorkflowLanguages
 * @property {string} [source]  - Source language for board drafts (default: config.lang)
 * @property {string} [publish] - Target language when publishing issues (default: config.lang)
 */

/**
 * @typedef {Object} WorkflowConfig
 * @property {WorkflowLanguages} [languages] - Language settings for `senti workflow` ([EXPERIMENTAL])
 */

/**
 * @typedef {Object} SentiConfig
 * @property {string} [name]                 - Project name (optional, set by setup wizard)
 * @property {DocsConfig} docs               - Documentation configuration (required)
 * @property {string} lang                   - Operating language for CLI, AGENTS.md, skills, specs
 * @property {string|string[]} type          - Preset name(s) (e.g. "symfony" or ["symfony", "postgres"])
 * @property {number} [concurrency]          - Per-file concurrency (default: 5)
 * @property {AgentConfig} [agent]           - AI agent invocation settings
 * @property {FlowConfig} [flow]             - Flow configuration
 * @property {TestConfig} [test]             - Project-level regression test configuration
 * @property {CommandsConfig} [commands]     - External command availability
 * @property {LogsConfig} [logs]             - Logging configuration
 * @property {WorkflowConfig} [workflow]     - `senti workflow` settings ([EXPERIMENTAL])
 */
