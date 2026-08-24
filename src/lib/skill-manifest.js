const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const NAME_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const REQUIRED_FIELDS = new Set(["name", "description"]);

function sourceLabel(sourcePath) {
  return sourcePath || "SKILL.md";
}

function parseScalar(value, field, sourcePath) {
  const scalar = value.trim();
  if (scalar === "") return "";
  if (scalar.startsWith("\"") || scalar.startsWith("'")) {
    const quote = scalar[0];
    if (!scalar.endsWith(quote)) {
      throw new Error(`invalid ${field} scalar in ${sourceLabel(sourcePath)}`);
    }
    if (quote === "\"") {
      try {
        const parsed = JSON.parse(scalar);
        if (typeof parsed !== "string") throw new Error("not a string");
        return parsed;
      } catch (_) {
        throw new Error(`invalid ${field} scalar in ${sourceLabel(sourcePath)}`);
      }
    }
    return scalar.slice(1, -1).replaceAll("''", "'");
  }
  return scalar;
}

function parseFrontmatter(content, sourcePath) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    throw new Error(`skill frontmatter is missing in ${sourceLabel(sourcePath)}`);
  }
  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex < 0) {
    throw new Error(`skill frontmatter is not closed in ${sourceLabel(sourcePath)}`);
  }

  const fields = new Map();
  const frontmatter = lines.slice(1, closingIndex);
  for (let index = 0; index < frontmatter.length; index += 1) {
    const line = frontmatter[index];
    if (line.trim() === "" || line.trimStart().startsWith("#") || /^\s/.test(line)) continue;
    const match = /^([a-zA-Z0-9-]+):(?:\s*(.*))?$/.exec(line);
    if (!match) {
      throw new Error(`invalid skill frontmatter entry in ${sourceLabel(sourcePath)}: ${line}`);
    }
    const [, key, value = ""] = match;
    if (!REQUIRED_FIELDS.has(key)) continue;
    if (fields.has(key)) {
      throw new Error(`duplicate skill frontmatter key "${key}" in ${sourceLabel(sourcePath)}`);
    }
    if (/^[>|][+-]?$/.test(value)) {
      const block = [];
      while (index + 1 < frontmatter.length && /^\s/.test(frontmatter[index + 1])) {
        block.push(frontmatter[index + 1].replace(/^\s+/, ""));
        index += 1;
      }
      fields.set(key, value.startsWith(">") ? block.join(" ") : block.join("\n"));
    } else {
      fields.set(key, value);
    }
  }
  return fields;
}

/**
 * Validated identity and discovery metadata for one deployable skill.
 *
 * Skill names use hyphen-case within each dot-separated namespace segment.
 * This preserves host-compatible names such as `sennel.flow-auto` while
 * preventing path-like or ambiguous directory names.
 */
export class SkillManifest {
  constructor({ name, description, directoryName, sourcePath }) {
    if (!NAME_PATTERN.test(name)) {
      throw new Error(
        `invalid skill name "${name}" in ${sourceLabel(sourcePath)}; use lowercase letters and digits, `
        + "hyphens within names, and dots only as namespace separators",
      );
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new Error(`skill name "${name}" exceeds ${MAX_NAME_LENGTH} characters in ${sourceLabel(sourcePath)}`);
    }
    if (name !== directoryName) {
      throw new Error(
        `skill name "${name}" does not match source directory "${directoryName}" in ${sourceLabel(sourcePath)}`,
      );
    }
    if (description === "") {
      throw new Error(`skill description is empty in ${sourceLabel(sourcePath)}`);
    }
    if (description.startsWith("[TODO:")) {
      throw new Error(`invalid skill description in ${sourceLabel(sourcePath)}`);
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(
        `skill description exceeds ${MAX_DESCRIPTION_LENGTH} characters in ${sourceLabel(sourcePath)}`,
      );
    }

    this.name = name;
    this.description = description;
    Object.freeze(this);
  }

  static parse(content, { directoryName, sourcePath } = {}) {
    const fields = parseFrontmatter(content, sourcePath);
    if (!fields.has("name")) {
      throw new Error(`skill name is missing in ${sourceLabel(sourcePath)}`);
    }
    if (!fields.has("description")) {
      throw new Error(`skill description is missing in ${sourceLabel(sourcePath)}`);
    }
    const name = parseScalar(fields.get("name"), "name", sourcePath);
    const description = parseScalar(fields.get("description"), "description", sourcePath);
    return new SkillManifest({ name, description, directoryName, sourcePath });
  }
}
