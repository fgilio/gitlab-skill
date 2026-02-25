#!/usr/bin/env bun
// IN: project, job_id, [count]  OUT: progress text + summary  VIA: glabApi direct

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-job-retry-loop <org/project> <job-id> [count]

Retry a job N times, waiting for each to complete.
Useful for flaky test detection.

Default count: 10
Logs to: /tmp/gitlab-retry-loop-<job-id>.log`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const projectRaw = args[0];
const project = validateProject(projectRaw);
let currentJobId = validateNumericId(args[1], "Job ID");
const count = args[2] ? validateNumericId(args[2], "Count") : 10;

const logFile = `/tmp/gitlab-retry-loop-${args[1]}.log`;
const results: string[] = [];

const writer = Bun.file(logFile).writer();

function log(msg: string) {
  const line = msg + "\n";
  process.stdout.write(line);
  writer.write(line);
}

// Clear log file
await Bun.write(logFile, "");

log(`Log file: ${logFile}`);
log(`Project: ${projectRaw}`);
log(`Starting job: ${currentJobId}`);
log(`Iterations: ${count}`);
log("");

for (let i = 1; i <= count; i++) {
  log(`=== Run ${i}/${count} - Job ${currentJobId} ===`);

  // Wait for current job to complete
  while (true) {
    let status: string;
    try {
      const job = await glabApi("GET", `projects/${project}/jobs/${currentJobId}`);
      status = job.status || "error";
    } catch {
      status = "error";
    }

    if (status === "success") {
      log(`✓ Job ${currentJobId}: SUCCESS`);
      results.push(`${i}:${currentJobId}:success`);
      break;
    } else if (status === "failed") {
      log(`✗ Job ${currentJobId}: FAILED`);
      results.push(`${i}:${currentJobId}:failed`);
      break;
    } else if (status === "canceled") {
      log(`⊘ Job ${currentJobId}: CANCELED`);
      results.push(`${i}:${currentJobId}:canceled`);
      break;
    } else {
      log(`  Waiting... (status: ${status})`);
      await Bun.sleep(30_000);
    }
  }

  // If not last iteration, retry to get new job
  if (i < count) {
    try {
      const newJob = await glabApi("POST", `projects/${project}/jobs/${currentJobId}/retry`);
      if (newJob?.id) {
        currentJobId = newJob.id;
        log(`  Retried -> New job: ${currentJobId}`);
      } else {
        log("  ERROR retrying: no job ID in response");
        break;
      }
    } catch (e) {
      log(`  ERROR retrying: ${e instanceof Error ? e.message : String(e)}`);
      break;
    }
  }

  log("");
}

log("");
log("=== SUMMARY ===");
let passed = 0;
let failed = 0;
for (const r of results) {
  log(r);
  if (r.endsWith(":success")) passed++;
  else failed++;
}
log("");
log(`Passed: ${passed} / ${results.length}`);
log(`Failed: ${failed} / ${results.length}`);

writer.end();
