#!/usr/bin/env bun
// IN: project, job_id  OUT: JSON  VIA: GET /jobs/:id

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-job-status <org/project> <job-id>

Get CI job status.`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const jobId = validateNumericId(args[1], "Job ID");

try {
  const job = await glabApi("GET", `projects/${project}/jobs/${jobId}`);
  console.log(JSON.stringify({
    id: job.id,
    name: job.name,
    status: job.status,
    web_url: job.web_url,
  }, null, 2));
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
