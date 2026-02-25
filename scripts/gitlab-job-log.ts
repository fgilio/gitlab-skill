#!/usr/bin/env bun
// IN: project, job_id  OUT: plain text  VIA: GET /jobs/:id/trace

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-job-log <org/project> <job-id>

Get job log output (plain text with ANSI codes).`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const jobId = validateNumericId(args[1], "Job ID");

try {
  const text = await glabApi("GET", `projects/${project}/jobs/${jobId}/trace`, { rawText: true });
  process.stdout.write(text);
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
