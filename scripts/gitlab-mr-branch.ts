#!/usr/bin/env bun
// IN: project, mr_id  OUT: branch name string  VIA: GET /merge_requests/:iid

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-mr-branch <org/project> <mr-id>

Get the source branch name from an MR.`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const mrId = validateNumericId(args[1], "MR ID");

try {
  const mr = await glabApi("GET", `projects/${project}/merge_requests/${mrId}`);
  console.log(JSON.stringify(mr.source_branch));
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
