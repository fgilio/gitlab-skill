#!/usr/bin/env bun
// IN: project, [ref]  OUT: {id, status, ref, web_url} or null  VIA: GET /projects/:id/pipelines

import { glabApi, validateProject, printUsage, exitError } from "./lib.ts";

const args = Bun.argv.slice(2);
const USAGE = `Usage: gitlab-pipeline-latest <org/project> [ref]

Get the latest pipeline for a project. Optionally filter by branch/tag.
Returns: {id, status, ref, web_url} or null.`;

if (args.includes("--help") || args.includes("-h")) printUsage(USAGE, 0);
if (args.length < 1) printUsage(USAGE, 1);

const project = validateProject(args[0]);
const ref = args[1];

try {
  const query: Record<string, string | number> = {
    per_page: 1,
    order_by: "id",
    sort: "desc",
  };
  if (ref) query.ref = ref;

  const pipelines = await glabApi("GET", `projects/${project}/pipelines`, { query });

  if (!Array.isArray(pipelines) || pipelines.length === 0) {
    console.log(JSON.stringify(null));
  } else {
    const p = pipelines[0];
    console.log(JSON.stringify({ id: p.id, status: p.status, ref: p.ref, web_url: p.web_url }));
  }
} catch (e) {
  exitError(e instanceof Error ? e.message : String(e));
}
