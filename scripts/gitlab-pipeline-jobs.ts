#!/usr/bin/env bun
// IN: project, pipeline_id, [filter]  OUT: JSON array  VIA: GET /pipelines/:id/jobs

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-pipeline-jobs <org/project> <pipeline-id> [filter]

List jobs in a pipeline.

Filters:
  all        All jobs including skipped/pending (default)
  failed     Only failed jobs
  executed   Jobs that ran (success, failed, canceled)`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const pipelineId = validateNumericId(args[1], "Pipeline ID");
const filter = args[2] || "all";

if (!["all", "failed", "executed"].includes(filter)) {
  exitError("Invalid filter. Use: all, failed, executed");
}

try {
  const jobs: any[] = await glabApi(
    "GET",
    `projects/${project}/pipelines/${pipelineId}/jobs`,
    { query: { per_page: 100 } }
  );

  if (jobs.length >= 100) {
    exitError("Pipeline has 100+ jobs. Pagination support needed.");
  }

  let result: any[];
  if (filter === "failed") {
    result = jobs.filter((j: any) => j.status === "failed");
  } else if (filter === "executed") {
    result = jobs.filter((j: any) => ["failed", "success", "canceled"].includes(j.status));
  } else {
    result = jobs;
  }

  // Shape output to {id, name, status}
  const shaped = result.map((j: any) => ({ id: j.id, name: j.name, status: j.status }));
  console.log(JSON.stringify(shaped, null, 2));
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
