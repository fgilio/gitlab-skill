#!/usr/bin/env bun
// IN: project, mr_id, flags  OUT: JSON  VIA: PUT /merge_requests/:iid/merge

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-mr-merge <org/project> <mr-id> [options]

Merge a merge request.

Options:
  --squash                  Squash commits
  --remove-source-branch    Delete source branch after merge
  --when-pipeline-succeeds  Merge when pipeline succeeds (MWPS)
  --message <text>          Custom merge commit message`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const mrId = validateNumericId(args[1], "MR ID");

const apiBody: Record<string, unknown> = {};

const remaining = args.slice(2);
let i = 0;
while (i < remaining.length) {
  switch (remaining[i]) {
    case "--squash":
      apiBody.squash = true;
      i++;
      break;
    case "--remove-source-branch":
      apiBody.should_remove_source_branch = true;
      i++;
      break;
    case "--when-pipeline-succeeds":
      apiBody.merge_when_pipeline_succeeds = true;
      i++;
      break;
    case "--message":
      if (i + 1 >= remaining.length) exitError("--message requires a value");
      apiBody.merge_commit_message = remaining[i + 1];
      i += 2;
      break;
    default:
      exitError(`Unknown option: ${remaining[i]}`);
  }
}

try {
  const res = await glabApi("PUT", `projects/${project}/merge_requests/${mrId}/merge`, {
    body: Object.keys(apiBody).length > 0 ? apiBody : undefined,
  });
  const status = res.merge_when_pipeline_succeeds
    ? "merge_when_pipeline_succeeds"
    : (res.state === "merged" ? "merged" : res.state);
  console.log(JSON.stringify({
    id: mrId,
    project: args[0],
    status,
    url: res.web_url,
  }, null, 2));
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
