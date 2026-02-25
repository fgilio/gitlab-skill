# GitLab API Reference

Reference for GitLab REST API operations used by the skill scripts.

## API Basics

### Authentication
Scripts use `GITLAB_TOKEN` env var or fall back to parsing `glab auth status -t`.
Token is sent as `PRIVATE-TOKEN` header on every request.

### Base URL
Determined by `GITLAB_HOST` env var:
- Not set -> `https://gitlab.com/api/v4`
- `gitlab.company.com` -> `https://gitlab.company.com/api/v4`
- `https://gitlab.company.com` -> `https://gitlab.company.com/api/v4`

### URL Encoding
Project paths are URL-encoded: `publicala/farfalla` -> `publicala%2Ffarfalla`.
File paths are also URL-encoded for the repository files API.
Scripts handle this internally via `encodeURIComponent()`.

### Project Path Format
Scripts use `org/project` format (e.g., `publicala/farfalla`).

## MR Operations

### View MR Details
```
GET /projects/:id/merge_requests/:iid
```

### Create MR
```
POST /projects/:id/merge_requests
Body: {title, source_branch, target_branch, description?, draft?, labels?}
```
Note: `source_branch` is required (no "current branch" concept via API).

### Update MR
```
PUT /projects/:id/merge_requests/:iid
Body: {title?, description?, draft?, labels?, target_branch?}
```

### Close MR
```
PUT /projects/:id/merge_requests/:iid
Body: {state_event: "close"}
```

## Discussions API Structure

GitLab discussions can be:
- Single comments or threads (with replies)
- Open or resolved

The API returns system notes (e.g., "marked as draft"), filter with `resolvable == true`.

### Discussion Object Fields
- `individual_note: true` -> single comment, `false` -> thread with replies
- `notes[0].resolvable == true` -> real comment (excludes system notes)
- `notes[0].resolved` -> resolution status
- `notes | length` -> total messages in thread (1 = no replies)

### Endpoints
```
# List discussions
GET /projects/:id/merge_requests/:iid/discussions?per_page=100

# Create general comment
POST /projects/:id/merge_requests/:iid/discussions
Body: {body: "comment text"}

# Create inline comment (requires diff_refs from MR)
POST /projects/:id/merge_requests/:iid/discussions
Body: {body: "comment", position: {base_sha, head_sha, start_sha, position_type: "text", new_path, old_path, new_line OR old_line}}

# Reply to discussion
POST /projects/:id/merge_requests/:iid/discussions/:discussion_id/notes
Body: {body: "reply text"}
```

## Pipeline Operations

### Get Pipeline ID from MR
```
GET /projects/:id/merge_requests/:iid
-> .head_pipeline.id
```

### Get Jobs from Pipeline
```
GET /projects/:id/pipelines/:pipeline_id/jobs?per_page=100
```

### View Job Logs
```
GET /projects/:id/jobs/:job_id/trace
Returns: plain text (raw CI log)
```

### Retry Job
```
POST /projects/:id/jobs/:job_id/retry
Returns: new job object
```
Only works on finished jobs (success, failed, canceled).

## Repository Files

### Get File Content
```
GET /projects/:id/repository/files/:file_path/raw?ref=branch
Returns: plain text file content
```

## Error Response Shapes

GitLab returns errors in various shapes. The `glabApi` function normalizes all:
- `{error: "msg"}` -> `"msg"`
- `{message: "msg"}` -> `"msg"`
- `{message: {field: ["err1", "err2"]}}` -> `"field: err1, err2"`
- `{message: ["err1"]}` -> `"err1"`
- Non-JSON body -> HTTP status text
