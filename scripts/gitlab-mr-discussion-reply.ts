#!/usr/bin/env bun
// IN: project, mr_id, discussion_id, --body  OUT: JSON  VIA: POST /discussions/:id/notes

import { glabApi, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";
import { readFileSync } from "fs";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-mr-discussion-reply <org/project> <mr-id> <discussion-id> --body <text>

Reply to an existing discussion thread.

Options:
  --body <text>       Reply content (markdown supported)
  --body-file <path>  Read reply content from file`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 3) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const mrId = validateNumericId(args[1], "MR ID");
const discussionId = args[2];

if (!discussionId) exitError("Discussion ID is required");

// Parse flags from remaining args
let body = "";
const remaining = args.slice(3);
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
    default:
      exitError(`Unknown option: ${remaining[i]}`);
  }
}

if (!body) exitError("Reply body is required. Use --body or --body-file");

try {
  const note = await glabApi(
    "POST",
    `projects/${project}/merge_requests/${mrId}/discussions/${discussionId}/notes`,
    { body: { body } }
  );
  console.log(JSON.stringify({
    note_id: note.id,
    discussion_id: note.noteable_iid,
    author: note.author?.username,
    created_at: note.created_at,
  }, null, 2));
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
