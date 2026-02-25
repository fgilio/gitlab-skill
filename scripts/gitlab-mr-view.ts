#!/usr/bin/env bun
// IN: project, mr_id  OUT: JSON  VIA: GET /merge_requests/:iid

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-mr-view <org/project> <mr-id>

Get full MR details as JSON.`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const mrId = validateNumericId(args[1], "MR ID");

try {
  const mr = await glabApi("GET", `projects/${project}/merge_requests/${mrId}`);
  console.log(JSON.stringify({
    id: mr.iid,
    title: mr.title,
    description: mr.description,
    state: mr.state,
    draft: mr.draft,
    source_branch: mr.source_branch,
    target_branch: mr.target_branch,
    author: mr.author?.username,
    url: mr.web_url,
    pipeline_status: mr.head_pipeline?.status ?? null,
    pipeline_id: mr.head_pipeline?.id ?? null,
    labels: mr.labels,
    created_at: mr.created_at,
    updated_at: mr.updated_at,
  }, null, 2));
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
