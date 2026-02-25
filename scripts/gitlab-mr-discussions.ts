#!/usr/bin/env bun
// IN: project, mr_id, [filter]  OUT: JSON array  VIA: GET /merge_requests/:iid/discussions

import { glabApiPaginated, validateProject, validateNumericId, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-mr-discussions <org/project> <mr-id> [filter]

Get MR discussions (comments and threads). Excludes system notes.

Filters:
  open       Unresolved discussions only (default)
  resolved   Resolved discussions only
  all        All discussions`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 2) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const mrId = validateNumericId(args[1], "MR ID");
const filter = args[2] || "open";

if (!["open", "resolved", "all"].includes(filter)) {
  exitError("Invalid filter. Use: open, resolved, all");
}

try {
  const discussions: any[] = await glabApiPaginated(
    `projects/${project}/merge_requests/${mrId}/discussions`,
    { query: { per_page: 100 } }
  );

  // Filter to resolvable (non-system) notes only
  const resolvable = discussions.filter((d: any) => d.notes?.[0]?.resolvable === true);

  let result: any[];
  if (filter === "open") {
    result = resolvable.filter((d: any) => d.notes[0].resolved === false);
  } else if (filter === "resolved") {
    result = resolvable.filter((d: any) => d.notes[0].resolved === true);
  } else {
    result = resolvable;
  }

  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
