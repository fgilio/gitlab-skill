# gitlab-skill

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill for GitLab operations. Talks directly to the GitLab REST API via Bun/TypeScript - no `glab` CLI required.

Give Claude the ability to create and manage merge requests, inspect pipelines, retry jobs, post review comments, and read repository files - all without leaving the terminal.

## Prerequisites

- [Bun](https://bun.sh) runtime
- A GitLab personal access token (or `glab` CLI authenticated as fallback)

## Installation

Clone into your Claude Code skills directory:

```bash
git clone https://github.com/fgilio/gitlab-skill.git ~/.claude/skills/gitlab
cd ~/.claude/skills/gitlab && bun install
```

Or symlink if you already have it elsewhere:

```bash
ln -s /path/to/gitlab-skill ~/.claude/skills/gitlab
```

## Authentication

Set `GITLAB_TOKEN` as an environment variable. The skill falls back to parsing `glab auth status -t` if the env var is missing.

For self-hosted GitLab, set `GITLAB_HOST` (e.g. `gitlab.company.com`). Defaults to `gitlab.com`.

## Commands

| Command | What it does |
|---------|-------------|
| `gitlab-mr-create` | Create a merge request |
| `gitlab-mr-update` | Update title, description, labels, draft status |
| `gitlab-mr-view` | Get full MR details as JSON |
| `gitlab-mr-close` | Close a merge request |
| `gitlab-mr-branch` | Get source branch name from MR |
| `gitlab-mr-discussions` | List discussion threads (open/resolved/all) |
| `gitlab-mr-discussion-create` | Start a new thread (general or inline) |
| `gitlab-mr-discussion-reply` | Reply to an existing thread |
| `gitlab-pipeline-from-mr` | Get head pipeline ID from MR |
| `gitlab-pipeline-jobs` | List jobs in a pipeline (all/failed/executed) |
| `gitlab-job-log` | Get raw CI job log output |
| `gitlab-job-status` | Get job status and URL |
| `gitlab-job-retry` | Retry a finished job |
| `gitlab-job-retry-loop` | Retry job N times for flaky test detection |
| `gitlab-file-view` | Read a file from a repository |

## Usage examples

```bash
# Create a draft MR
gitlab-mr-create org/project "Fix login bug" --source fix/login --draft

# Check pipeline status
gitlab-pipeline-from-mr org/project 42
gitlab-pipeline-jobs org/project 123456 failed

# Post an inline review comment
gitlab-mr-discussion-create org/project 42 --body "Needs a nil check" --file src/auth.ts --line 15

# Read a file from a specific branch
gitlab-file-view org/project config/app.yml staging
```

All commands output JSON to stdout and errors to stderr with exit code 1.

## How it works

Each command is a standalone Bun/TypeScript script in `scripts/`. They share a common `lib.ts` that handles token discovery, URL encoding, input validation, and error normalization. No external HTTP libraries - just `fetch()`.

## Full reference

See [SKILL.md](SKILL.md) for the complete Claude Code skill definition with all options and output formats.

## License

MIT
