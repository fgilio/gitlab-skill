#!/usr/bin/env bun
// IN: project, mr_id  OUT: pipeline ID or null  VIA: GET /merge_requests/:iid

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-pipeline-from-mr <org/project> <mr-id>

Get the head pipeline ID from an MR. Returns number or null.`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const mrId = validateNumericId(args[1], "MR ID");

try {
  const mr = await glabApi("GET", `projects/${project}/merge_requests/${mrId}`);
  console.log(mr.head_pipeline?.id ?? null);
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
