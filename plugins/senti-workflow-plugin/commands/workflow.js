import { servicesFor } from "../lib/services/context.js";
import {
  assertAddStatus,
  assertCategory,
  assertHash,
  assertJapanese,
  assertJapaneseOptional,
  assertNonEmpty,
  assertSafeSpecPath,
  invalid,
} from "../lib/services/validation.js";

export const publicSurface = {
  add: { positionals: ["title"], options: ["--status", "--category", "--body"] },
  update: { positionals: ["hash"], options: ["--status", "--title", "--body"] },
  show: { positionals: ["hash"], options: [] },
  search: { positionals: ["query"], options: [] },
  list: { positionals: [], options: ["--status"] },
  publish: { positionals: ["hash"], options: ["--label"] },
  ideas: { positionals: [], options: ["--spec"] },
};

function helpText() {
  return [
    "[EXPERIMENTAL] senti workflow",
    "",
    "Usage: senti workflow <subcommand> [args]",
    "",
    "Subcommands:",
    "  add <title> [--status Ideas|To-do] [--category RESEARCH|BUG|ENHANCE|OTHER] [--body <text>]",
    "  update <hash> [--status <status>] [--title <text>] [--body <text>]",
    "  show <hash>",
    "  search <query>",
    "  list [--status <status>]",
    "  publish <hash> [--label <label>]",
    "  ideas --spec <spec>",
  ].join("\n");
}

function parseOptions(argv, allowedOptions) {
  const positional = [];
  const options = {};
  const allowed = new Set(allowedOptions);
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value.startsWith("--")) {
      if (!allowed.has(value)) throw invalid(`unknown option: ${value}`);
      if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) throw invalid(`${value} requires a value`);
      options[value.slice(2)] = argv[++i];
    } else {
      positional.push(value);
    }
  }
  return { positional, options };
}

function inputFor(subcommand, rest) {
  const surface = publicSurface[subcommand];
  if (!surface) throw invalid(`unknown subcommand: ${subcommand}`);
  const { positional, options } = parseOptions(rest, surface.options);
  if (positional.length > surface.positionals.length) throw invalid(`too many positional arguments for ${subcommand}`);
  const input = { ...options };
  for (const [index, name] of surface.positionals.entries()) input[name] = positional[index];

  switch (subcommand) {
    case "add":
      assertJapanese(input.title, "title");
      assertAddStatus(input.status);
      assertCategory(input.category);
      assertJapaneseOptional(input.body, "body");
      return { title: input.title, ...(input.status ? { status: input.status } : {}), ...(input.category ? { category: input.category } : {}), ...(input.body ? { body: input.body } : {}) };
    case "update":
      assertHash(input.hash);
      if (input.status != null) assertNonEmpty(input.status, "--status");
      assertJapaneseOptional(input.title, "title");
      assertJapaneseOptional(input.body, "body");
      return { hash: input.hash, ...(input.status ? { status: input.status } : {}), ...(input.title ? { title: input.title } : {}), ...(input.body ? { body: input.body } : {}) };
    case "show":
      assertHash(input.hash);
      return { hash: input.hash };
    case "search":
      assertNonEmpty(input.query, "query");
      return { query: input.query };
    case "list":
      if (input.status != null) assertNonEmpty(input.status, "--status");
      return input.status ? { status: input.status } : {};
    case "publish":
      assertHash(input.hash);
      if (input.label != null) assertNonEmpty(input.label, "--label");
      return { hash: input.hash, ...(input.label ? { label: input.label } : {}) };
    case "ideas":
      assertSafeSpecPath(input.spec);
      return { spec: input.spec };
    default:
      throw invalid(`unknown subcommand: ${subcommand}`);
  }
}

function fail(api, key, err) {
  return {
    ...api.Envelope.fail("workflow", key, err.code || "ERROR", err.message),
    exitCode: 1,
  };
}

export default function register(api) {
  return {
    publicSurface,
    async main(argv = [], ctx = {}) {
      const subcommand = argv[0];
      if (!subcommand || subcommand === "-h" || subcommand === "--help") {
        return api.Envelope.ok("workflow", "help", { help: helpText() });
      }

      try {
        const input = inputFor(subcommand, argv.slice(1));
        const services = servicesFor(ctx);
        const routes = {
          add: () => services.board.add(input),
          update: () => services.board.update(input),
          show: () => services.board.show(input),
          search: () => services.board.search(input),
          list: () => services.board.list(input),
          publish: () => services.publish.publish(input),
          ideas: () => services.ideas.extract(input),
        };
        const result = await routes[subcommand]();
        return api.Envelope.ok("workflow", subcommand, result || {});
      } catch (err) {
        return fail(api, subcommand || "workflow", err);
      }
    },
  };
}
