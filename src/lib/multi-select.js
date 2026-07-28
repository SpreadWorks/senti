/**
 * src/lib/multi-select.js
 *
 * Interactive select widget for terminal.
 * Supports single-select and multi-select modes with arrow key navigation.
 * Does not depend on readline — manages raw mode stdin directly.
 */

/**
 * @typedef {Object} SelectItem
 * @property {string} key       - Unique identifier
 * @property {string} label     - Display label
 * @property {string} [prefix]  - Optional display prefix (e.g. tree-drawing chars)
 * @property {string} [parent]  - Parent key (for autoSelectAncestors)
 */

/**
 * Build a flattened tree item list from presets for display.
 * Each item includes a parent field for ancestor auto-selection.
 *
 * @param {{ key: string, parent: string|null, label: string }[]} presets
 * @returns {SelectItem[]}
 */
export function buildTreeItems(presets) {
  const childrenMap = new Map();
  const presetMap = new Map();

  for (const p of presets) {
    presetMap.set(p.key, p);
    if (!childrenMap.has(p.key)) childrenMap.set(p.key, []);
    const parentKey = p.parent || null;
    if (parentKey) {
      if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
      childrenMap.get(parentKey).push(p.key);
    }
  }

  const roots = presets
    .filter((p) => !p.parent || !presetMap.has(p.parent))
    .map((p) => p.key);

  const items = [];

  function walk(key, ownPrefix, childPrefix) {
    const p = presetMap.get(key);
    items.push({
      key,
      label: `${key} (${p.label})`,
      prefix: ownPrefix,
      parent: p.parent || null,
    });

    const kids = childrenMap.get(key) || [];
    for (let i = 0; i < kids.length; i++) {
      const isLast = i === kids.length - 1;
      walk(
        kids[i],
        childPrefix + (isLast ? "└── " : "├── "),
        childPrefix + (isLast ? "    " : "│   "),
      );
    }
  }

  for (const root of roots) {
    walk(root, "", "");
  }

  return items;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function formatSelectLine(item, cursor, index, mode, selected) {
  const prefix = item.prefix || "";
  const marker = index === cursor ? ">" : " ";
  const selection = `${marker} `;
  const content = mode === "single"
    ? item.label
    : `${selected.has(item.key) ? "[x]" : "[ ]"} ${item.label}`;

  // Keep the tree connector at the left edge of every tree item. Placing the
  // cursor marker before it shifts only the focused row and breaks the tree.
  return ` ${prefix}${selection}${content}`;
}

function renderLine(output, item, cursor, index, mode, selected) {
  const line = formatSelectLine(item, cursor, index, mode, selected);

  if (index === cursor) {
    output.write(`\r\x1B[2K\x1B[36m${line}\x1B[0m\n`);
  } else {
    output.write(`\r\x1B[2K${line}\n`);
  }
}

// ---------------------------------------------------------------------------
// Core select
// ---------------------------------------------------------------------------

const R = "\x1B[31m";
const Z = "\x1B[0m";
const HINT_SINGLE = `<${R}↑↓${Z}> MOVE | <${R}enter${Z}> OK`;
const HINT_MULTI = `<${R}↑↓${Z}> MOVE | <${R}space${Z}> SELECT | <${R}enter${Z}> OK`;

/**
 * Interactive select widget.
 * Manages raw mode stdin directly — no readline dependency.
 *
 * @param {SelectItem[]} items - Items in display order
 * @param {Object} [opts]
 * @param {"single"|"multi"} [opts.mode="multi"]
 * @param {boolean} [opts.autoSelectAncestors=false] - Auto-select parent items (multi only)
 * @param {string|string[]} [opts.default] - Default key(s). Single: initial cursor position. Multi: pre-selected keys.
 * @param {string} [opts.hint] - Custom hint text
 * @returns {Promise<string|string[]>} single → key string, multi → key array
 */
export function select(items, opts = {}) {
  const mode = opts.mode || "multi";

  if (!process.stdin.isTTY) {
    return Promise.resolve(mode === "single" ? items[0]?.key : []);
  }

  return new Promise((resolve) => {
    const hint = opts.hint || (mode === "single" ? HINT_SINGLE : HINT_MULTI);
    const selected = new Set();
    let cursor = 0;

    // Apply defaults
    if (opts.default) {
      const defaults = Array.isArray(opts.default) ? opts.default : [opts.default];
      if (mode === "single") {
        const idx = items.findIndex((it) => it.key === defaults[0]);
        if (idx >= 0) cursor = idx;
      } else {
        for (const d of defaults) {
          if (items.some((it) => it.key === d)) selectKey(d);
        }
      }
    }

    const output = process.stdout;
    const input = process.stdin;

    input.setRawMode(true);
    input.resume();

    // Viewport: show a window of items that fits the terminal
    // Reserve 3 lines: blank above list, blank above hint, hint
    const maxVisible = Math.max(5, (output.rows || 24) - 3);
    const needsScroll = items.length > maxVisible;
    const viewSize = needsScroll ? maxVisible : items.length;
    let viewStart = 0;
    // Render region: viewSize item lines + 1 blank line = viewSize + 1
    // (hint has no trailing \n, so cursor stays on hint line)
    const renderLines = viewSize + 1;

    let rendered = false;

    // Blank line between label and list (outside render region)
    output.write("\n");

    function adjustViewport() {
      // Ensure cursor is visible within the item slots (excluding ... lines)
      const topReserved = (needsScroll && viewStart > 0) ? 1 : 0;
      const bottomReserved = (needsScroll && viewStart + viewSize < items.length) ? 1 : 0;
      const firstVisible = viewStart + topReserved;
      const lastVisible = viewStart + viewSize - bottomReserved - 1;

      if (cursor < firstVisible) {
        viewStart = cursor;
      } else if (cursor > lastVisible) {
        // Place cursor at the last item slot
        const br = (viewStart + viewSize < items.length) ? 1 : 0;
        viewStart = cursor - viewSize + 1 + br;
      }
      if (viewStart < 0) viewStart = 0;
    }

    function render() {
      adjustViewport();

      if (rendered) {
        output.write(`\x1B[${renderLines}A`);
      }

      const showTop = needsScroll && viewStart > 0;
      const showBottom = needsScroll && viewStart + viewSize < items.length;

      // Always render exactly viewSize lines
      if (showTop) {
        output.write(`\r\x1B[2K     ...\n`);
      }

      const itemStart = viewStart + (showTop ? 1 : 0);
      const itemCount = viewSize - (showTop ? 1 : 0) - (showBottom ? 1 : 0);
      for (let i = 0; i < itemCount; i++) {
        renderLine(output, items[itemStart + i], cursor, itemStart + i, mode, selected);
      }

      if (showBottom) {
        output.write(`\r\x1B[2K     ...\n`);
      }

      output.write(`\r\x1B[2K\n`);        // blank line
      output.write(`\r\x1B[2K  ${hint}`); // hint
      rendered = true;
    }

    function selectAncestors(key) {
      const item = items.find((it) => it.key === key);
      if (item?.parent) {
        selected.add(item.parent);
        selectAncestors(item.parent);
      }
    }

    function selectKey(key) {
      selected.add(key);
      if (opts.autoSelectAncestors) selectAncestors(key);
    }

    render();

    function cleanup() {
      input.removeListener("data", onData);
      input.setRawMode(false);
      output.write("\n");
    }

    function onData(buf) {
      const seq = buf.toString();
      if (seq === "\x1B[A") {
        if (cursor > 0) cursor--;
        render();
      } else if (seq === "\x1B[B") {
        if (cursor < items.length - 1) cursor++;
        render();
      } else if ((seq === " " || seq === "\u3000") && mode === "multi") {
        const item = items[cursor];
        if (selected.has(item.key)) {
          selected.delete(item.key);
        } else {
          selectKey(item.key);
        }
        render();
      } else if (seq === "\r" || seq === "\n") {
        if (mode === "multi" && selected.size === 0) return;
        cleanup();
        if (mode === "single") {
          resolve(items[cursor].key);
        } else {
          resolve(items.filter((it) => selected.has(it.key)).map((it) => it.key));
        }
      } else if (seq === "\x03") {
        cleanup();
        process.exit(0);
      } else {
        // Ignore unknown keys but redraw to prevent visual corruption
        render();
      }
    }

    input.on("data", onData);
  });
}
