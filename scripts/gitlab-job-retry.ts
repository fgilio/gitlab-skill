#!/usr/bin/env bun
// IN: project, job_id  OUT: JSON  VIA: POST /jobs/:id/retry

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-job-retry <org/project> <job-id>

Retry a finished CI job (failed, success, or canceled).
Returns the new job created by the retry.`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const jobId = validateNumericId(args[1], "Job ID");

try {
  const job = await glabApi("POST", `projects/${project}/jobs/${jobId}/retry`);
  console.log(JSON.stringify({
    id: job.id,
    name: job.name,
    status: job.status,
    web_url: job.web_url,
  }, null, 2));
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
