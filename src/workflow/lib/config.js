import { execFileSync } from "node:child_process";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" });
}

export function loadBoardConfig() {
  // owner from current repo
  const repo = JSON.parse(gh(["repo", "view", "--json", "owner,name"]));
  const owner = repo.owner.login;
  const repoName = repo.name;

  // find project with same name as repo
  const projects = JSON.parse(gh(["project", "list", "--owner", owner, "--format", "json"]));
  const project = projects.projects.find((p) => p.title === repoName);
  if (!project) {
    throw new Error(
      `"${repoName}" と同名のプロジェクトが ${owner} に見つかりません。GitHub Projects でプロジェクトを作成してください`
    );
  }

  return { owner, project: project.number, repo: `${owner}/${repoName}` };
}
