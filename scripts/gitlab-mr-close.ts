#!/usr/bin/env bun
// IN: project, mr_id  OUT: JSON  VIA: PUT /merge_requests/:iid {state_event: "close"}

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-mr-close <org/project> <mr-id>

Close a merge request.`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const mrId = validateNumericId(args[1], "MR ID");

try {
  await glabApi("PUT", `projects/${project}/merge_requests/${mrId}`, {
    body: { state_event: "close" },
  });
  console.log(JSON.stringify({
    id: mrId,
    project: args[0],
    status: "closed",
  }, null, 2));
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
