---
name: gitlab
description: >
  Zero-error GitLab operations via direct API fetch (Bun/TypeScript).
  Use when user mentions GitLab, MR, merge request, pipeline, CI, job logs,
  or discussion threads. Handles token discovery, URL encoding, error
  normalization, and all API quirks internally.
user-invocable: true
disable-model-invocation: false
license: MIT
compatibility: Requires Bun runtime. Works on macOS and Linux.
metadata:
  author: fgilio
  version: 2.0.0
---

# GitLab Skill

**Goal**: Eliminate GitLab API errors by design. Scripts handle all quirks internally.

All scripts are globally available in PATH - invoke them directly by name.

**Authentication**: `GITLAB_TOKEN` env var, or falls back to `glab auth status -t`.
**Base URL**: `GITLAB_HOST` env var (e.g. `gitlab.company.com`), or defaults to `gitlab.com`.

---

## Quick Reference

| Script | Purpose | Output |
|--------|---------|--------|
| `gitlab-mr-create` | Create MR | `{url, id, project}` |
| `gitlab-mr-update` | Update MR | `{id, project, updated}` |
| `gitlab-mr-view` | Get MR details | Full MR object |
| `gitlab-mr-close` | Close MR | `{id, project, status}` |
| `gitlab-mr-branch` | Get source branch | `"branch-name"` |
| `gitlab-mr-discussions` | Get comments/threads | `[{discussion}, ...]` |
| `gitlab-mr-discussion-create` | Start new thread | `{discussion_id, note_id, ...}` |
| `gitlab-mr-discussion-reply` | Reply to thread | `{note_id, discussion_id, ...}` |
| `gitlab-pipeline-from-mr` | Get pipeline ID | `123456` or `null` |
| `gitlab-pipeline-jobs` | List pipeline jobs | `[{id, name, status}, ...]` |
| `gitlab-job-log` | Get job logs | Plain text |
| `gitlab-job-status` | Get job status | `{id, name, status, web_url}` |
| `gitlab-job-retry` | Retry a job | `{id, name, status, web_url}` |
| `gitlab-job-retry-loop` | Retry job N times | Summary stats |
| `gitlab-file-view` | Get file from repo | Plain text |

---

## MR Operations

### gitlab-mr-create

Create a new merge request.

```bash
gitlab-mr-create <org/project> <title> [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--description <text>` | MR description (markdown supported) | none |
| `--description-file <path>` | Read description from file | none |
| `--target <branch>` | Target branch | `main` |
| `--source <branch>` | Source branch | **required** |
| `--draft` | Create as draft | false |
| `--labels <l1,l2>` | Comma-separated labels | none |
| `--push` | Push branch before creating | false |

**Output:**
```json
{"url": "https://gitlab.com/.../merge_requests/123", "id": 123, "project": "org/project"}
```

**Example:**
```bash
gitlab-mr-create publicala/farfalla "Fix: login bug" --description "Fixes #42" --draft
```

---

### gitlab-mr-update

Update an existing merge request.

```bash
gitlab-mr-update <org/project> <mr-id> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--title <text>` | New title |
| `--description <text>` | New description |
| `--description-file <path>` | Read description from file |
| `--draft` | Mark as draft |
| `--ready` | Mark as ready (remove draft) |
| `--labels <l1,l2>` | Set labels |
| `--target <branch>` | Change target branch |

**Output:**
```json
{"id": 123, "project": "org/project", "updated": ["title", "draft"]}
```

---

### gitlab-mr-view

Get full MR details.

```bash
gitlab-mr-view <org/project> <mr-id>
```

**Output:**
```json
{
  "id": 123,
  "title": "Fix: login bug",
  "description": "Fixes #42",
  "state": "opened",
  "draft": false,
  "source_branch": "fix/login",
  "target_branch": "main",
  "author": "username",
  "url": "https://gitlab.com/.../merge_requests/123",
  "pipeline_status": "success",
  "pipeline_id": 456789,
  "labels": ["bug", "priority::high"],
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T12:00:00Z"
}
```

---

### gitlab-mr-close

Close a merge request.

```bash
gitlab-mr-close <org/project> <mr-id>
```

**Output:**
```json
{"id": 123, "project": "org/project", "status": "closed"}
```

---

### gitlab-mr-branch

Get the source branch name from an MR.

```bash
gitlab-mr-branch <org/project> <mr-id>
```

**Output:**
```json
"fix/login-bug"
```

---

### gitlab-mr-discussions

Get MR discussions (comments and threads). Excludes system notes.

```bash
gitlab-mr-discussions <org/project> <mr-id> [filter]
```

**Filters:**
| Filter | Description | Default |
|--------|-------------|---------|
| `open` | Unresolved discussions only | **Yes** |
| `resolved` | Resolved discussions only | |
| `all` | All discussions | |

**Output:** Array of GitLab discussion objects:
```json
[
  {
    "id": "abc123",
    "individual_note": false,
    "notes": [
      {
        "body": "Please fix this",
        "author": {"username": "reviewer"},
        "created_at": "...",
        "resolved": false,
        "position": {"new_path": "src/file.js", "new_line": 42}
      },
      {"body": "Fixed!", "author": {"username": "developer"}}
    ]
  }
]
```

---

### gitlab-mr-discussion-create

Start a new discussion thread on an MR. Supports both general comments and inline (diff) comments.

```bash
gitlab-mr-discussion-create <org/project> <mr-id> --body <text> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--body <text>` | Comment content (required) |
| `--body-file <path>` | Read content from file |
| `--file <path>` | File path for inline comment |
| `--line <n>` | Line number in new version (added/modified lines) |
| `--old-line <n>` | Line number in old version (removed lines) |

**Output:**
```json
{
  "discussion_id": "abc123...",
  "note_id": 12345,
  "author": "username",
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Examples:**
```bash
# General comment
gitlab-mr-discussion-create publicala/pla-cli 42 --body "Looks good!"

# Inline comment on added line
gitlab-mr-discussion-create publicala/pla-cli 42 --body "Fix this" --file src/foo.js --line 10

# Inline comment on removed line
gitlab-mr-discussion-create publicala/pla-cli 42 --body "Why removed?" --file src/foo.js --old-line 5
```

---

### gitlab-mr-discussion-reply

Reply to an existing discussion thread.

```bash
gitlab-mr-discussion-reply <org/project> <mr-id> <discussion-id> --body <text>
```

**Options:**
| Option | Description |
|--------|-------------|
| `--body <text>` | Reply content (markdown supported) |
| `--body-file <path>` | Read reply content from file |

**Output:**
```json
{
  "note_id": 12345,
  "discussion_id": 123,
  "author": "username",
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Example:**
```bash
# Get discussion ID from gitlab-mr-discussions
gitlab-mr-discussions publicala/pla-cli 42 | jq '.[0].id'

# Reply to that discussion
gitlab-mr-discussion-reply publicala/pla-cli 42 "abc123def..." --body "Fixed in latest commit"
```

---

## Pipeline Operations

### gitlab-pipeline-from-mr

Get the head pipeline ID from an MR.

```bash
gitlab-pipeline-from-mr <org/project> <mr-id>
```

**Output:**
- Pipeline ID as number: `2185720401`
- Or `null` if no pipeline

---

### gitlab-pipeline-jobs

List jobs in a pipeline.

```bash
gitlab-pipeline-jobs <org/project> <pipeline-id> [filter]
```

**Filters:**
| Filter | Description | Default |
|--------|-------------|---------|
| `all` | All jobs (including skipped, pending) | **Yes** |
| `failed` | Only failed jobs | |
| `executed` | Jobs that ran (success, failed, canceled) | |

**Output:**
```json
[
  {"id": 123, "name": "test:unit", "status": "success"},
  {"id": 124, "name": "test:e2e", "status": "failed"},
  {"id": 125, "name": "deploy", "status": "skipped"}
]
```

---

### gitlab-job-log

Get job log output.

```bash
gitlab-job-log <org/project> <job-id>
```

**Output:** Plain text (raw CI log with ANSI codes)

---

### gitlab-job-status

Get job status.

```bash
gitlab-job-status <org/project> <job-id>
```

**Output:**
```json
{"id": 123, "name": "test:unit", "status": "running", "web_url": "https://gitlab.com/.../jobs/123"}
```

---

### gitlab-job-retry

Retry a finished job (failed, success, or canceled).

```bash
gitlab-job-retry <org/project> <job-id>
```

**Output:**
```json
{"id": 12345678, "name": "test:unit", "status": "pending", "web_url": "https://gitlab.com/.../jobs/12345678"}
```

**Note:** The returned `id` is the new job created by the retry.

---

### gitlab-job-retry-loop

Retry a job N times, waiting for each to complete. Useful for flaky test detection.

```bash
gitlab-job-retry-loop <org/project> <job-id> [count]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `count` | Number of iterations | 10 |

**Output:** Logs to `/tmp/gitlab-retry-loop-<job-id>.log` and stdout.

```
Log file: /tmp/gitlab-retry-loop-123456.log
=== Run 1/10 - Job 123456 ===
✓ Job 123456: SUCCESS
  Retried -> New job: 123457
...
=== SUMMARY ===
Passed: 8 / 10
Failed: 2 / 10
```

**Tailing:** `tail -f /tmp/gitlab-retry-loop-<job-id>.log`

---

## Repository Operations

### gitlab-file-view

Get file contents from a repository.

```bash
gitlab-file-view <org/project> <file-path> [ref]
```

**Parameters:**
| Parameter | Description | Required |
|-----------|-------------|----------|
| `org/project` | Project path | Yes |
| `file-path` | Path within repo | Yes |
| `ref` | Branch/tag/commit | No (default branch) |

**Output:** Plain text (raw file content)

**Examples:**
```bash
# Get file from default branch
gitlab-file-view publicala/farfalla README.md

# Get file from specific branch
gitlab-file-view publicala/farfalla bootstrap/app.php master

# Get file from specific commit
gitlab-file-view publicala/farfalla config/app.php abc123
```

---

## Error Handling

All scripts return JSON errors to stderr with exit code 1:

```json
{"error": "Invalid project format. Use: org/project"}
{"error": "MR ID must be a positive number"}
{"error": "Not found (404)"}
{"error": "Unauthorized (401) - check your GitLab token"}
```

---

## What Scripts Handle Internally

- **URL encoding**: `org/project` -> URL-encoded project path
- **Token management**: Auto-discovers token from env or glab auth
- **Input validation**: Project format, numeric IDs, required flags
- **System note filtering**: Discussions exclude system notes
- **Error normalization**: GitLab's varied error shapes -> consistent JSON
- **Consistent JSON**: All operations return parseable output

---

## Reference

- [references/api-reference.md](references/api-reference.md) - API reference and examples
- [references/pipelines-guide.md](references/pipelines-guide.md) - GitLab CI/CD best practices (rules, cache, artifacts)
