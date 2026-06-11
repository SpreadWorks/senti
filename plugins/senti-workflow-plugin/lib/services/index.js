import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { WorkflowAgentResolver } from "./agent.js";

const MAX_IDEA_ENTRIES = 200;
const MAX_BOARD_PAGES = 10;
const PAGE_SIZE = 100;
const BOARD_DELEGATE_METHODS = ["add", "update", "show", "search", "list"];

function normalizeConfig(config = {}) {
  return config.workflow ? config : { workflow: config };
}

function parseJson(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("```")) {
    const lines = trimmed.split("\n");
    if (lines.length >= 3 && lines.at(-1) === "```") {
      return JSON.parse(lines.slice(1, -1).join("\n"));
    }
  }
  return JSON.parse(trimmed);
}

function createFallbackAgent() {
  return {
    resolve() {
      return false;
    },
    async call() {
      throw new Error("workflow agent is not configured");
    },
  };
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" });
}

function ghJson(args) {
  return JSON.parse(gh(args));
}

function readIssueLogEntries(projectRoot, spec) {
  if (!projectRoot || !spec) return [];
  const file = path.resolve(projectRoot, path.dirname(spec), "issue-log.json");
  const root = path.resolve(projectRoot);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.entries)) return parsed.entries;
  return [];
}

function createBoardServices(boardClient) {
  return Object.fromEntries(BOARD_DELEGATE_METHODS.map((method) => [
    method,
    (input) => boardClient[method](input),
  ]));
}

function ghGraphQL(query, variables = {}) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables)) args.push("-f", `${key}=${value}`);
  const result = ghJson(args);
  if (result.errors) throw new Error(result.errors.map((entry) => entry.message).join(", "));
  return result;
}

function loadBoardConfig() {
  const repo = ghJson(["repo", "view", "--json", "owner,name"]);
  const owner = repo.owner.login;
  const repoName = repo.name;
  const projects = ghJson(["project", "list", "--owner", owner, "--format", "json"]);
  const project = projects.projects.find((entry) => entry.title === repoName);
  if (!project) throw new Error(`GitHub Project not found for ${owner}/${repoName}`);
  return { owner, project: project.number, repo: `${owner}/${repoName}` };
}

const ITEM_FIELDS = `
  id
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue { name }
  }
  content {
    ... on DraftIssue { draftId: id title body }
    ... on Issue { title number url body }
  }
`;

function searchItems(boardConfig, queryText, limit = 20) {
  const result = ghGraphQL(`
    query {
      organization(login: "${boardConfig.owner}") {
        projectV2(number: ${boardConfig.project}) {
          items(first: ${limit}, query: ${JSON.stringify(queryText)}) {
            totalCount
            nodes { ${ITEM_FIELDS} }
          }
        }
      }
    }`);
  return result.data.organization.projectV2.items;
}

function listItems(boardConfig) {
  const nodes = [];
  let totalCount = 0;
  let cursor = null;
  for (let page = 0; page < MAX_BOARD_PAGES; page += 1) {
    const afterClause = cursor ? `, after: "${cursor}"` : "";
    const result = ghGraphQL(`
      query {
        organization(login: "${boardConfig.owner}") {
          projectV2(number: ${boardConfig.project}) {
            items(first: ${PAGE_SIZE}${afterClause}) {
              totalCount
              pageInfo { hasNextPage endCursor }
              nodes { ${ITEM_FIELDS} }
            }
          }
        }
      }`);
    const items = result.data.organization.projectV2.items;
    totalCount = items.totalCount;
    nodes.push(...items.nodes);
    if (!items.pageInfo.hasNextPage) break;
    cursor = items.pageInfo.endCursor;
  }
  return { nodes, totalCount };
}

function formatItem(node) {
  const content = node.content || {};
  const title = content.title || "(no title)";
  const id = title.includes(": ") ? title.split(": ", 1)[0] : null;
  return {
    id,
    status: node.fieldValueByName?.name || null,
    title,
    issueNumber: content.number || null,
    issueUrl: content.url || null,
    body: content.body || null,
  };
}

function findItem(nodes, hash) {
  return nodes.find((node) => String(node.content?.title || "").startsWith(`${hash}: `));
}

function createDefaultBoardClient() {
  return {
    async add(input) {
      const boardConfig = loadBoardConfig();
      const out = ghJson([
        "project", "item-create", String(boardConfig.project),
        "--owner", boardConfig.owner,
        "--title", input.title,
        "--format", "json",
        ...(input.body ? ["--body", input.body] : []),
      ]);
      return { id: out.id, title: input.title, status: input.status || "Ideas" };
    },
    async update(input) {
      return { ...input, updated: true };
    },
    async show(input) {
      const boardConfig = loadBoardConfig();
      const item = findItem(searchItems(boardConfig, input.hash).nodes, input.hash);
      if (!item) throw new Error(`hash "${input.hash}" not found`);
      return formatItem(item);
    },
    async search(input) {
      const boardConfig = loadBoardConfig();
      const items = searchItems(boardConfig, input.query);
      return { query: input.query, totalCount: items.totalCount, items: items.nodes.map(formatItem) };
    },
    async list(input = {}) {
      const boardConfig = loadBoardConfig();
      const items = listItems(boardConfig);
      const filtered = input.status ? items.nodes.filter((node) => node.fieldValueByName?.name === input.status) : items.nodes;
      return { totalCount: items.totalCount, count: filtered.length, items: filtered.map(formatItem) };
    },
    async moveIssue(input) {
      return { issue: input.issue, matched: false, skipped: true, reason: "board mutation is unavailable in fallback client" };
    },
  };
}

function createDefaultGithubClient() {
  return {
    async createIssue(input) {
      const args = ["issue", "create", "--title", input.title, "--body", input.body || ""];
      for (const label of input.labels || []) args.push("--label", label);
      const url = gh(args).trim();
      return { url };
    },
    async publish(input) {
      return this.createIssue(input);
    },
  };
}

export function createWorkflowServices({
  boardClient = createDefaultBoardClient(),
  githubClient = createDefaultGithubClient(),
  agent = createFallbackAgent(),
  config = {},
  rootConfig = {},
  projectRoot = null,
} = {}) {
  const normalizedConfig = normalizeConfig(config);
  const lang = rootConfig.lang || "en";
  const resolver = new WorkflowAgentResolver({ agent, config: normalizedConfig, lang });

  return {
    board: createBoardServices(boardClient),
    publish: {
      async publish(input) {
        const item = boardClient.get ? await boardClient.get(input) : await boardClient.show(input);
        const sourceLang = normalizedConfig.workflow?.languages?.source || rootConfig.lang || "en";
        const publishLang = normalizedConfig.workflow?.languages?.publish || rootConfig.lang || "en";
        let title = item.title || input.hash;
        let body = item.body || "";
        const prepared = parseJson(await resolver.publish(`Prepare issue for ${publishLang} from ${sourceLang}:\n${title}\n\n${body}`, { item, sourceLang, publishLang }));
        title = prepared.title || title;
        body = prepared.body || body;
        const labels = input.label ? [input.label] : (input.labels || []);
        return (githubClient.createIssue || githubClient.publish).call(githubClient, { title, body, labels, hash: input.hash });
      },
    },
    issueStart: {
      start(input) {
        return boardClient.moveIssue(input);
      },
    },
    ideas: {
      async extract(input) {
        const entries = (input.issueLogEntries || readIssueLogEntries(projectRoot, input.spec)).slice(0, MAX_IDEA_ENTRIES);
        const candidates = [];
        if (entries.length === 0) {
          await resolver.classify(`Classify empty issue-log for ${input.spec}`, { spec: input.spec });
          return { spec: input.spec, count: 0, candidates };
        }
        for (const entry of entries) {
          await resolver.classify(`Classify issue-log entry:\n${JSON.stringify(entry)}`, { entry });
          await resolver.similarity(`Compare issue-log entry:\n${JSON.stringify(entry)}`, { entry });
          const composed = parseJson(await resolver.compose(`Compose board idea:\n${JSON.stringify(entry)}`, { entry }));
          candidates.push({ entry, ...composed });
          if (candidates.length >= MAX_IDEA_ENTRIES) break;
        }
        return { spec: input.spec, count: candidates.length, candidates };
      },
    },
  };
}
