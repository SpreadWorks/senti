import { execFileSync } from "node:child_process";

function ghGraphQL(query, variables = {}) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [k, v] of Object.entries(variables)) {
    args.push("-f", `${k}=${v}`);
  }
  const out = execFileSync("gh", args, { encoding: "utf8" });
  const result = JSON.parse(out);
  if (result.errors) {
    throw new Error(result.errors.map((e) => e.message).join(", "));
  }
  return result;
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

export function searchItems(owner, project, queryText, limit = 20) {
  const q = `
    query {
      organization(login: "${owner}") {
        projectV2(number: ${project}) {
          items(first: ${limit}, query: ${JSON.stringify(queryText)}) {
            totalCount
            nodes { ${ITEM_FIELDS} }
          }
        }
      }
    }`;
  const result = ghGraphQL(q);
  return result.data.organization.projectV2.items;
}

export function listItems(owner, project) {
  const pageSize = 100;
  const allNodes = [];
  let totalCount = 0;
  let cursor = null;

  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : "";
    const q = `
      query {
        organization(login: "${owner}") {
          projectV2(number: ${project}) {
            items(first: ${pageSize}${afterClause}) {
              totalCount
              pageInfo { hasNextPage endCursor }
              nodes { ${ITEM_FIELDS} }
            }
          }
        }
      }`;
    const result = ghGraphQL(q);
    const items = result.data.organization.projectV2.items;
    totalCount = items.totalCount;
    allNodes.push(...items.nodes);
    if (!items.pageInfo.hasNextPage) break;
    cursor = items.pageInfo.endCursor;
  }

  return { nodes: allNodes, totalCount };
}

export function getProjectMeta(owner, project) {
  const q = `
    query {
      organization(login: "${owner}") {
        projectV2(number: ${project}) {
          id
          field(name: "Status") {
            ... on ProjectV2SingleSelectField {
              id
              options { id name }
            }
          }
        }
      }
    }`;
  const result = ghGraphQL(q);
  const p = result.data.organization.projectV2;
  return { projectId: p.id, statusField: p.field };
}

export function updateDraftIssue(draftIssueId, { title, body } = {}) {
  const fields = [];
  if (title !== undefined) fields.push(`title: ${JSON.stringify(title)}`);
  if (body !== undefined) fields.push(`body: ${JSON.stringify(body)}`);
  if (fields.length === 0) return;
  const q = `
    mutation {
      updateProjectV2DraftIssue(input: {
        draftIssueId: "${draftIssueId}"
        ${fields.join("\n        ")}
      }) {
        draftIssue { id }
      }
    }`;
  return ghGraphQL(q);
}

export function convertDraftToIssue(itemId, repositoryId) {
  const q = `
    mutation {
      convertProjectV2DraftIssueItemToIssue(input: {
        itemId: "${itemId}"
        repositoryId: "${repositoryId}"
      }) {
        item {
          id
          content {
            ... on Issue { number url }
          }
        }
      }
    }`;
  const result = ghGraphQL(q);
  return result.data.convertProjectV2DraftIssueItemToIssue.item;
}

export function getRepositoryId(owner, name) {
  const q = `
    query {
      repository(owner: "${owner}", name: "${name}") {
        id
      }
    }`;
  const result = ghGraphQL(q);
  return result.data.repository.id;
}

const MAX_SINGLE_SELECT_OPTIONS = 50;

export function addSingleSelectOption(fieldId, optionName) {
  const q = `
    query {
      node(id: "${fieldId}") {
        ... on ProjectV2SingleSelectField {
          options { id name color description }
        }
      }
    }`;
  const existing = ghGraphQL(q).data.node.options;
  if (existing.length >= MAX_SINGLE_SELECT_OPTIONS) {
    throw new Error(
      `cannot add option "${optionName}": SingleSelect field already has ${existing.length} options (limit ${MAX_SINGLE_SELECT_OPTIONS})`,
    );
  }

  const optionsInput = [
    ...existing.map(
      (o) =>
        `{ id: "${o.id}", name: ${JSON.stringify(o.name)}, color: ${o.color}, description: ${JSON.stringify(o.description || "")} }`,
    ),
    `{ name: ${JSON.stringify(optionName)}, color: GRAY, description: "" }`,
  ];

  const m = `
    mutation {
      updateProjectV2Field(input: {
        fieldId: "${fieldId}"
        singleSelectOptions: [${optionsInput.join(", ")}]
      }) {
        projectV2Field {
          ... on ProjectV2SingleSelectField {
            options { id name }
          }
        }
      }
    }`;
  const updated = ghGraphQL(m).data.updateProjectV2Field.projectV2Field.options;
  const created = updated.find((o) => o.name === optionName);
  if (!created) {
    throw new Error(`failed to create status option "${optionName}"`);
  }
  return created.id;
}

export function setItemStatus(projectId, itemId, fieldId, optionId) {
  const q = `
    mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${projectId}"
        itemId: "${itemId}"
        fieldId: "${fieldId}"
        value: { singleSelectOptionId: "${optionId}" }
      }) {
        projectV2Item { id }
      }
    }`;
  return ghGraphQL(q);
}
