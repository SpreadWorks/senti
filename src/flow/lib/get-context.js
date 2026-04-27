/**
 * src/flow/lib/get-context.js
 *
 * Retrieve analysis context in various modes:
 * - File mode (ctx.filePath): return file content
 * - Search mode (ctx.searchQuery): keyword search in analysis entries
 * - List mode (default): return filtered analysis entries
 *
 * ctx.filePath    — file path relative to root (file mode)
 * ctx.searchQuery — search query string (search mode)
 */

import fs from "fs";
import path from "path";
import { sddOutputDir, loadConfig } from "../../lib/config.js";
import { FlowCommand } from "./base-command.js";
import { ANALYSIS_META_KEYS } from "../../docs/lib/analysis-entry.js";
import { container } from "../../lib/container.js";

const EXCLUDE_FIELDS = new Set(["hash", "mtime", "lines", "id", "enrich", "detail"]);

function toSearchResult(e) {
  return {
    file: e.file,
    summary: e.summary || null,
    detail: e.detail || null,
    keywords: e.keywords,
    chapter: e.chapter || null,
    role: e.role || null,
  };
}

/**
 * Search analysis entries by keyword matching against the keywords array.
 * @param {Object[]} entries - Analysis entries (with keywords, summary, detail, etc.)
 * @param {string} query - Search query string
 * @returns {Object[]} Matched entries with file, summary, detail, keywords, chapter, role
 */
function searchEntries(entries, query) {
  const q = query.toLowerCase();
  return entries
    .filter((e) => {
      if (!Array.isArray(e.keywords)) return false;
      return e.keywords.some((kw) => String(kw).toLowerCase().includes(q));
    })
    .map((e) => ({
      file: e.file,
      summary: e.summary || null,
      detail: e.detail || null,
      keywords: e.keywords,
      chapter: e.chapter || null,
      role: e.role || null,
    }));
}

/**
 * Collect all unique keywords from analysis.json entries.
 * @param {Object} analysis - Parsed analysis.json
 * @returns {string[]} Unique keywords array
 */
function collectAllKeywords(analysis, limit = 2000) {
  const freq = new Map();
  for (const catKey of Object.keys(analysis)) {
    if (!analysis[catKey] || typeof analysis[catKey] !== "object") continue;
    if (ANALYSIS_META_KEYS.has(catKey)) continue;
    const entries = analysis[catKey].entries;
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      if (!Array.isArray(e.keywords)) continue;
      for (const kw of e.keywords) {
        const s = String(kw);
        freq.set(s, (freq.get(s) || 0) + 1);
      }
    }
  }
  // Sort by frequency descending, then alphabetically for stability
  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([kw]) => kw);
  return limit > 0 ? sorted.slice(0, limit) : sorted;
}

/**
 * Build a prompt for AI keyword selection.
 * @param {string[]} keywords - Available keywords from analysis
 * @param {string} query - User's natural language query
 * @returns {string} Prompt text
 */
function buildKeywordSelectionPrompt(keywords, query) {
  return [
    "You are a keyword selector. Given a query and a list of available keywords, select the keywords that are relevant to the query.",
    "",
    "## Query",
    query,
    "",
    "## Available keywords",
    keywords.join(", "),
    "",
    "## Rules",
    "- Select 5-20 keywords that are most relevant to the query.",
    "- Return ONLY a JSON array of selected keywords. No explanation, no markdown fences.",
    "- Include both direct matches and semantically related keywords.",
    '- Example output: ["auth", "認証", "session", "login"]',
  ].join("\n");
}

/**
 * Fallback search: split query by spaces, OR-match against keywords.
 * @param {Object[]} entries - Analysis entries
 * @param {string} query - Space-separated keywords
 * @returns {Object[]} Matched entries (deduplicated)
 */
function fallbackSearch(entries, query) {
  const terms = query.split(/\s+/).filter(Boolean).map((t) => t.toLowerCase());
  if (terms.length === 0) return [];
  const seen = new Set();
  const results = [];
  for (const e of entries) {
    if (!Array.isArray(e.keywords)) continue;
    const match = terms.some((t) =>
      e.keywords.some((kw) => String(kw).toLowerCase().includes(t))
    );
    if (match && !seen.has(e.file)) {
      seen.add(e.file);
      results.push({
        file: e.file,
        summary: e.summary || null,
        detail: e.detail || null,
        keywords: e.keywords,
        chapter: e.chapter || null,
        role: e.role || null,
      });
    }
  }
  return results;
}

const NGRAM_THRESHOLD = 0.15;

/**
 * Split text into bigrams (character pairs).
 * @param {string} text - Input text
 * @returns {string[]} Array of bigrams
 */
function toBigrams(text) {
  const s = text.toLowerCase();
  if (s.length < 2) return [];
  const bigrams = [];
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.push(s.slice(i, i + 2));
  }
  return bigrams;
}

/**
 * Calculate Dice coefficient between two bigram arrays.
 * @param {string[]} a - First bigram set
 * @param {string[]} b - Second bigram set
 * @returns {number} Similarity score between 0 and 1
 */
function bigramSimilarity(a, b) {
  if (a.length === 0 || b.length === 0) return 0.0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const bg of setA) {
    if (setB.has(bg)) intersection++;
  }
  return (2 * intersection) / (setA.size + setB.size);
}

/**
 * N-gram (bigram) based keyword search.
 * Compares query bigrams against entry keywords bigrams using Dice coefficient.
 * @param {Object[]} allEntries - All analysis entries
 * @param {string} query - Natural language query
 * @returns {Object[]} Matched entries sorted by score descending
 */
function ngramSearch(allEntries, query) {
  const queryBigrams = toBigrams(query);
  if (queryBigrams.length === 0) return [];

  const scored = [];
  for (const e of allEntries) {
    if (!Array.isArray(e.keywords) || e.keywords.length === 0) continue;
    // Compute max similarity across all keywords for this entry
    let maxScore = 0;
    for (const kw of e.keywords) {
      const kwBigrams = toBigrams(String(kw));
      const score = bigramSimilarity(queryBigrams, kwBigrams);
      if (score > maxScore) maxScore = score;
    }
    if (maxScore >= NGRAM_THRESHOLD) {
      scored.push({ entry: e, score: maxScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.map(({ entry }) => toSearchResult(entry));
}

/**
 * AI-powered keyword selection + static match search.
 * Falls back to space-split OR search if agent is unavailable.
 * @param {Object[]} allEntries - All analysis entries
 * @param {Object} analysis - Full analysis object (for keyword collection)
 * @param {string} query - Natural language query
 * @param {string} root - Project root path
 * @returns {Object[]} Matched entries
 */
async function aiSearch(allEntries, analysis, query, _root) {
  const allKeywords = collectAllKeywords(analysis);
  if (allKeywords.length === 0) return fallbackSearch(allEntries, query);

  const agent = container.get("agent");
  if (!agent.resolve("flow.context.search")) return fallbackSearch(allEntries, query);

  const prompt = buildKeywordSelectionPrompt(allKeywords, query);
  let response;
  try {
    response = await agent.call(prompt, { commandId: "flow.context.search" });
  } catch (err) {
    process.stderr.write(`[sdd-forge] context aiSearch agent call failed: ${err.message}\n`);
    return fallbackSearch(allEntries, query);
  }

  // Parse AI response as JSON array of keywords
  let selectedKeywords;
  try {
    const cleaned = response.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    selectedKeywords = JSON.parse(cleaned);
    if (!Array.isArray(selectedKeywords)) return fallbackSearch(allEntries, query);
  } catch (err) {
    process.stderr.write(`[sdd-forge] context aiSearch JSON parse failed: ${err.message}\n`);
    return fallbackSearch(allEntries, query);
  }

  // Use selected keywords for OR search
  if (selectedKeywords.length === 0) return fallbackSearch(allEntries, query);

  const terms = selectedKeywords.map((k) => String(k).toLowerCase());
  const seen = new Set();
  const results = [];
  for (const e of allEntries) {
    if (!Array.isArray(e.keywords)) continue;
    const match = terms.some((t) =>
      e.keywords.some((kw) => String(kw).toLowerCase().includes(t))
    );
    if (match && !seen.has(e.file)) {
      seen.add(e.file);
      results.push({
        file: e.file,
        summary: e.summary || null,
        detail: e.detail || null,
        keywords: e.keywords,
        chapter: e.chapter || null,
        role: e.role || null,
      });
    }
  }
  // If AI-selected keywords matched nothing, fall back to text search
  if (results.length === 0) return fallbackSearch(allEntries, query);
  return results;
}

/**
 * Dispatch search based on configured mode with fallback chain.
 * - ngram mode: ngramSearch → fallbackSearch → aiSearch
 * - ai mode: aiSearch → fallbackSearch (legacy behavior)
 * @param {Object[]} allEntries - All analysis entries
 * @param {Object} analysis - Full analysis object
 * @param {string} query - Search query
 * @param {string} root - Project root path
 * @param {string} mode - Search mode ("ngram" or "ai")
 * @returns {Object[]} Matched entries
 */
async function contextSearch(allEntries, analysis, query, root, mode = "ngram") {
  if (mode === "ai") {
    return aiSearch(allEntries, analysis, query, root);
  }

  // ngram mode (default): ngram → fallbackSearch → AI
  let results = ngramSearch(allEntries, query);
  if (results.length > 0) return results;

  results = fallbackSearch(allEntries, query);
  if (results.length > 0) return results;

  // Final fallback: try AI if agent is available
  return aiSearch(allEntries, analysis, query, root);
}

function filterEntry(entry) {
  const filtered = {};
  for (const [k, v] of Object.entries(entry)) {
    if (EXCLUDE_FIELDS.has(k)) continue;
    filtered[k] = v;
  }
  if (!filtered.summary) {
    filtered.needsSource = true;
  }
  return filtered;
}

function resolvePhase(state) {
  if (!state?.steps) return null;
  const active = state.steps.find((s) => s.status === "in_progress");
  if (active) {
    const id = active.id;
    if (["draft", "spec", "gate", "test"].includes(id)) return id;
    if (["implement", "review", "finalize"].includes(id)) return "impl";
  }
  return null;
}

/**
 * Load and flatten all analysis entries from analysis.json.
 * @param {string} root - Project root path
 * @returns {{ analysis: Object, entries: Object[] }}
 */
function loadAnalysisEntries(root) {
  const outputDir = sddOutputDir(root);
  const analysisPath = path.join(outputDir, "analysis.json");

  if (!fs.existsSync(analysisPath)) {
    throw new Error("analysis.json not found. Run: sdd-forge docs scan");
  }

  let analysis;
  try {
    analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
  } catch (e) {
    throw new Error(`Failed to parse analysis.json: ${e.message}`);
  }

  const entries = [];
  for (const catKey of Object.keys(analysis)) {
    if (ANALYSIS_META_KEYS.has(catKey)) continue;
    const catData = analysis[catKey];
    if (!catData || !Array.isArray(catData.entries)) continue;
    for (const entry of catData.entries) {
      entries.push(entry);
    }
  }

  return { analysis, entries };
}

export default class GetContextCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const filePath = ctx.filePath || ctx.path || null;
    const searchQuery = ctx.searchQuery || ctx.search || null;

    // File mode
    if (filePath) {
      const absPath = path.resolve(root, filePath);
      if (!fs.existsSync(absPath)) {
        throw new Error(`file not found: ${filePath}`);
      }

      const isDocsPath = filePath.startsWith("docs/") || filePath.startsWith("docs\\");
      const content = fs.readFileSync(absPath, "utf8");

      return {
        path: filePath,
        type: isDocsPath ? "docs" : "src",
        content,
      };
    }

    // Search mode
    if (searchQuery) {
      const { analysis, entries: allEntries } = loadAnalysisEntries(root);

      let config;
      try { config = loadConfig(root); } catch (_e) { config = {}; }
      const searchMode = config?.flow?.commands?.context?.search?.mode ?? "ngram";
      const results = await contextSearch(allEntries, analysis, searchQuery, root, searchMode);

      return {
        total: results.length,
        entries: results,
      };
    }

    // List mode
    const { entries: allEntries } = loadAnalysisEntries(root);
    const filtered = allEntries.map((entry) => filterEntry(entry));

    return {
      total: filtered.length,
      entries: filtered,
    };
  }
}

export { filterEntry, resolvePhase, searchEntries, collectAllKeywords, buildKeywordSelectionPrompt, fallbackSearch, toBigrams, bigramSimilarity, ngramSearch, loadAnalysisEntries, contextSearch };
