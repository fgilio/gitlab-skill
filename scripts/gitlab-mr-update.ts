#!/usr/bin/env bun
// IN: project, mr_id, flags  OUT: JSON  VIA: PUT /merge_requests/:iid

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";
import { readFileSync } from "fs";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-mr-update <org/project> <mr-id> [options]

Update an existing merge request.

Options:
  --title <text>          New title
  --description <text>    New description
  --description-file <f>  Read description from file
  --draft                 Mark as draft
  --ready                 Mark as ready (remove draft)
  --labels <l1,l2>        Set labels
  --target <branch>       Change target branch`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const mrId = validateNumericId(args[1], "MR ID");

const updated: string[] = [];
const apiBody: Record<string, unknown> = {};

const remaining = args.slice(2);
let i = 0;
while (i < remaining.length) {
  switch (remaining[i]) {
    case "--title":
      if (i + 1 >= remaining.length) exitError("--title requires a value");
      apiBody.title = remaining[i + 1];
      updated.push("title");
      i += 2;
      break;
    case "--description":
      if (i + 1 >= remaining.length) exitError("--description requires a value");
      apiBody.description = remaining[i + 1];
      updated.push("description");
      i += 2;
      break;
    case "--description-file":
      if (i + 1 >= remaining.length) exitError("--description-file requires a value");
      try {
        apiBody.description = readFileSync(remaining[i + 1], "utf-8");
      } catch {
        exitError(`File not found: ${remaining[i + 1]}`);
      }
      updated.push("description");
      i += 2;
      break;
    case "--draft":
      apiBody.draft = true;
      updated.push("draft");
      i++;
      break;
    case "--ready":
      apiBody.draft = false;
      updated.push("ready");
      i++;
      break;
    case "--labels":
      if (i + 1 >= remaining.length) exitError("--labels requires a value");
      apiBody.labels = remaining[i + 1];
      updated.push("labels");
      i += 2;
      break;
    case "--target":
      if (i + 1 >= remaining.length) exitError("--target requires a value");
      apiBody.target_branch = remaining[i + 1];
      updated.push("target_branch");
      i += 2;
      break;
    default:
      exitError(`Unknown option: ${remaining[i]}`);
  }
}

if (updated.length === 0) exitError("No update options provided");

try {
  await glabApi("PUT", `projects/${project}/merge_requests/${mrId}`, { body: apiBody });
  console.log(JSON.stringify({
    id: mrId,
    project: args[0],
    updated,
  }, null, 2));
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
