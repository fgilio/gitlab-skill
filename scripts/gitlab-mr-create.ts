#!/usr/bin/env bun
// IN: project, title, flags  OUT: JSON  VIA: POST /merge_requests

import { glabApi, validateProject, printUsage, exitError } from "./lib.ts";
import { readFileSync } from "fs";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-mr-create <org/project> <title> [options]

Create a new merge request.

Options:
  --description <text>    MR description (markdown supported)
  --description-file <f>  Read description from file
  --target <branch>       Target branch (default: main)
  --source <branch>       Source branch (required)
  --draft                 Create as draft
  --labels <l1,l2>        Comma-separated labels
  --push                  Push branch before creating (requires git repo)`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const projectRaw = args[0];
const title = args[1];
const project = validateProject(projectRaw);

if (title.startsWith("--")) {
  exitError('Title cannot start with "--". Did you forget the title argument?');
}

let targetBranch = "main";
let sourceBranch = "";
let description = "";
let draft = false;
let labels = "";
let push = false;

const remaining = args.slice(2);
let i = 0;
while (i < remaining.length) {
  switch (remaining[i]) {
    case "--description":
      if (i + 1 >= remaining.length) exitError("--description requires a value");
      description = remaining[i + 1];
      i += 2;
      break;
    case "--description-file":
      if (i + 1 >= remaining.length) exitError("--description-file requires a value");
      try {
        description = readFileSync(remaining[i + 1], "utf-8");
      } catch {
        exitError(`File not found: ${remaining[i + 1]}`);
      }
      i += 2;
      break;
    case "--target":
      if (i + 1 >= remaining.length) exitError("--target requires a value");
      targetBranch = remaining[i + 1];
      i += 2;
      break;
    case "--source":
      if (i + 1 >= remaining.length) exitError("--source requires a value");
      sourceBranch = remaining[i + 1];
      i += 2;
      break;
    case "--draft":
      draft = true;
      i++;
      break;
    case "--labels":
      if (i + 1 >= remaining.length) exitError("--labels requires a value");
      labels = remaining[i + 1];
      i += 2;
      break;
    case "--push":
      push = true;
      i++;
      break;
    default:
      exitError(`Unknown option: ${remaining[i]}`);
  }
}

if (!sourceBranch) exitError("--source <branch> is required");

// --push requires git context
if (push) {
  const proc = Bun.spawn(["git", "rev-parse", "--is-inside-work-tree"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    exitError("--push requires being inside a git repository");
  }

  const pushProc = Bun.spawn(["git", "push", "origin", sourceBranch], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const pushStderr = await new Response(pushProc.stderr).text();
  await pushProc.exited;
  if (pushProc.exitCode !== 0) {
    exitError(`Failed to push branch: ${pushStderr.trim()}`);
  }
}

const apiBody: Record<string, unknown> = {
  title,
  source_branch: sourceBranch,
  target_branch: targetBranch,
};
if (description) apiBody.description = description;
if (draft) apiBody.draft = true;
if (labels) apiBody.labels = labels;

try {
  const mr = await glabApi("POST", `projects/${project}/merge_requests`, { body: apiBody });

  if (!mr?.web_url) exitError("Could not parse MR URL from response");

  console.log(JSON.stringify({
    url: mr.web_url,
    id: mr.iid,
    project: projectRaw,
  }, null, 2));
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
