#!/usr/bin/env bun
// IN: project, mr_id, --body, [--file, --line/--old-line]  OUT: JSON  VIA: POST /discussions

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";
import { readFileSync } from "fs";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-mr-discussion-create <org/project> <mr-id> --body <text> [options]

Start a new discussion thread on an MR. Supports general and inline comments.

Options:
  --body <text>       Comment content (required)
  --body-file <path>  Read content from file
  --file <path>       File path for inline comment
  --line <n>          Line number in new version (added/modified lines)
  --old-line <n>      Line number in old version (removed lines)

Examples:
  # General comment
  gitlab-mr-discussion-create org/repo 123 --body "Looks good!"

  # Inline comment on added line
  gitlab-mr-discussion-create org/repo 123 --body "Fix this" --file src/foo.js --line 42`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const mrId = validateNumericId(args[1], "MR ID");

let body = "";
let file = "";
let line = "";
let oldLine = "";

const remaining = args.slice(2);
let i = 0;
while (i < remaining.length) {
  switch (remaining[i]) {
    case "--body":
      if (i + 1 >= remaining.length) exitError("--body requires a value");
      body = remaining[i + 1];
      i += 2;
      break;
    case "--body-file":
      if (i + 1 >= remaining.length) exitError("--body-file requires a value");
      try {
        body = readFileSync(remaining[i + 1], "utf-8");
      } catch {
        exitError(`File not found: ${remaining[i + 1]}`);
      }
      i += 2;
      break;
    case "--file":
      if (i + 1 >= remaining.length) exitError("--file requires a value");
      file = remaining[i + 1];
      i += 2;
      break;
    case "--line":
      if (i + 1 >= remaining.length) exitError("--line requires a value");
      line = remaining[i + 1];
      i += 2;
      break;
    case "--old-line":
      if (i + 1 >= remaining.length) exitError("--old-line requires a value");
      oldLine = remaining[i + 1];
      i += 2;
      break;
    default:
      exitError(`Unknown option: ${remaining[i]}`);
  }
}

if (!body) exitError("Comment body is required. Use --body or --body-file");

// Validate inline comment options
if (file && !line && !oldLine) exitError("--file requires --line or --old-line");
if (!file && (line || oldLine)) exitError("--line and --old-line require --file");
if (line && oldLine) exitError("Cannot use both --line and --old-line");

const apiPath = `projects/${project}/merge_requests/${mrId}/discussions`;

try {
  if (!file) {
    // General comment
    const discussion = await glabApi("POST", apiPath, { body: { body } });
    console.log(JSON.stringify({
      discussion_id: discussion.id,
      note_id: discussion.notes?.[0]?.id,
      author: discussion.notes?.[0]?.author?.username,
      created_at: discussion.notes?.[0]?.created_at,
    }, null, 2));
  } else {
    // Inline comment - fetch diff_refs first
    const mr = await glabApi("GET", `projects/${project}/merge_requests/${mrId}`);
    const diffRefs = mr.diff_refs;

    if (!diffRefs?.base_sha || !diffRefs?.head_sha || !diffRefs?.start_sha) {
      exitError("Could not get diff_refs from MR");
    }

    const position: Record<string, unknown> = {
      base_sha: diffRefs.base_sha,
      head_sha: diffRefs.head_sha,
      start_sha: diffRefs.start_sha,
      position_type: "text",
      new_path: file,
      old_path: file,
    };

    if (line) {
      position.new_line = Number(line);
    } else {
      position.old_line = Number(oldLine);
    }

    const discussion = await glabApi("POST", apiPath, {
      body: { body, position },
    });

    console.log(JSON.stringify({
      discussion_id: discussion.id,
      note_id: discussion.notes?.[0]?.id,
      author: discussion.notes?.[0]?.author?.username,
      created_at: discussion.notes?.[0]?.created_at,
    }, null, 2));
  }
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
