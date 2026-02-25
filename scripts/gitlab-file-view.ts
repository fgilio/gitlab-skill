#!/usr/bin/env bun
// IN: project, file_path, [ref]  OUT: plain text  VIA: GET /repository/files/:path/raw

import { glabApi, validateProject, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-file-view <org/project> <file-path> [ref]

Get file contents from a repository (plain text).
Optional ref: branch, tag, or commit SHA (defaults to project default branch).`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const filePath = args[1];
const ref = args[2];

if (!filePath) exitError("File path is required");

// URL-encode the file path (/ -> %2F)
const encodedFile = encodeURIComponent(filePath);

const query: Record<string, string> = {};
if (ref) query.ref = ref;

try {
  const text = await glabApi("GET", `projects/${project}/repository/files/${encodedFile}/raw`, {
    rawText: true,
    query: Object.keys(query).length ? query : undefined,
  });
  process.stdout.write(text);
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
