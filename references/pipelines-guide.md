# GitLab Pipelines Guide

A lean, practical guide to GitLab CI/CD pipelines focusing on the tricky parts.

## Overview & Common Misconceptions

**Key Misconceptions:**
- ❌ "Cache is always available" → Cache is an optimization, not guaranteed
- ❌ "Artifacts = Cache" → Different purposes, storage, and lifecycles
- ❌ "Rules are OR conditions" → Rules are evaluated sequentially, first match wins
- ❌ "Jobs always run in stage order" → `needs` creates DAG pipelines

**Pipeline Execution Flow:**
1. `workflow:rules` determines if pipeline is created
2. Job `rules` determine which jobs run
3. Jobs execute based on stages or `needs` dependencies

## Pipeline Rules (workflow:rules)

Controls **entire pipeline creation** before any jobs are considered.

### Important: Implicit `when` Behavior
- **No `when` specified = Pipeline IS created** (implicit `when: always`)
- Only accepts `when: always` or `when: never`
- If NO rules match, pipeline is NOT created

### Prevent Duplicate Pipelines
```yaml
workflow:
  rules:
    # Run for merge requests
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      # Implicit: when: always (pipeline created)
    
    # Run for default branch
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      # Implicit: when: always (pipeline created)
    
    # Run for tags
    - if: $CI_COMMIT_TAG
      # Implicit: when: always (pipeline created)
    
    # Prevent duplicate branch pipelines when MR exists
    - if: $CI_COMMIT_BRANCH && $CI_OPEN_MERGE_REQUESTS
      when: never  # MUST be explicit to prevent pipeline
    
    # Run for other branches
    - if: $CI_COMMIT_BRANCH
      # Implicit: when: always (pipeline created)
```

### Common Pipeline Sources
- `push` - Git push events
- `merge_request_event` - MR created/updated
- `schedule` - Scheduled pipelines
- `api` - Triggered via API
- `web` - Manual pipeline from UI
- `pipeline` - Downstream pipeline

## Job Rules

Controls **individual job execution** within a pipeline.

### Important: Implicit `when` Behavior
- **No `when` specified = `when: on_success`** (job runs only if previous stages succeeded)
- NOT like CSS cascade - each rule gets its own default independently
- To run regardless of failures, must explicitly use `when: always`

### Rule Evaluation
- Evaluated **in order** until first match
- First match determines job behavior
- No match = job doesn't run

### Common Patterns
```yaml
deploy:
  rules:
    # Manual deployment for production
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
      allow_failure: true  # Pipeline can pass without deploying
    
    # Auto-deploy to staging (only if previous stages succeeded)
    - if: $CI_COMMIT_BRANCH == "staging"
      # Implicit: when: on_success
    
    # Skip drafts
    - if: $CI_MERGE_REQUEST_TITLE =~ /^Draft:/
      when: never  # Must be explicit to skip
```

### Manual Jobs: allow_failure Explained
**Why `allow_failure: true` with `when: manual`?**

```yaml
# BLOCKING manual job (pipeline waits)
deploy-critical:
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
      # Default: allow_failure: false
  script: deploy prod
  # Pipeline status: "blocked" until someone deploys

# NON-BLOCKING manual job (pipeline continues)
deploy-optional:
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
      allow_failure: true  # Makes deploy optional
  script: deploy prod
  # Pipeline status: "passed" even without deploying
```

**Use cases for `allow_failure: true` on manual jobs:**
- Optional production deploys after tests pass
- Deploy that shouldn't block subsequent stages (like notifications)
- "Deploy when ready" workflows where timing is flexible

**Pipeline behavior:**
- ❌ Without: Pipeline shows "blocked", waits for action
- ✅ With: Pipeline shows "passed", deploy is optional

### when: on_success vs when: always
```yaml
cleanup:
  rules:
    - if: $CI_COMMIT_BRANCH
      when: always  # Runs even if tests failed
  script: rm -rf temp/

test-results:
  rules:
    - if: $CI_COMMIT_BRANCH
      # Implicit: when: on_success (only runs if build succeeded)
  script: analyze results/
```

### Rules with Changes - Deep Dive

**Critical Concept:** `changes` behaves differently in merge request vs branch pipelines!

#### The Problem with Branch Pipelines
```yaml
# WARNING: This always runs on new branches!
frontend-tests:
  rules:
    - changes:
        - frontend/**/*
```
**Why?** On a new branch, `changes` has nothing to compare to, so it returns `true` for everything.

#### Merge Request Pipelines (Works as Expected)
```yaml
# In MR pipelines, compares source branch to target branch
frontend-tests:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes:
        - frontend/**/*
        - package.json
  script: npm test
```

#### The Solution: compare_to for Branch Pipelines
```yaml
# Now works correctly for branch pipelines too!
frontend-tests:
  rules:
    - if: $CI_COMMIT_BRANCH
      changes:
        paths:  # Required with compare_to
          - frontend/**/*
          - package.json
        compare_to: 'refs/heads/main'  # Compare against main branch
  script: npm test
```

#### Combining Changes with Other Conditions
```yaml
deploy-frontend:
  rules:
    # Deploy only if frontend changed AND it's main branch
    - if: $CI_COMMIT_BRANCH == "main"
      changes:
        - frontend/**/*
      when: manual
      allow_failure: true
    
    # Auto-deploy to staging if frontend changed
    - if: $CI_COMMIT_BRANCH == "staging"
      changes:
        paths:
          - frontend/**/*
        compare_to: 'refs/heads/main'
```

#### Monorepo Pattern
```yaml
# Service A - only runs when its files change
service-a-tests:
  rules:
    - changes:
        paths:
          - services/service-a/**/*
          - shared-libs/**/*  # Also run if shared libs change
        compare_to: 'refs/heads/main'
  script: cd services/service-a && npm test

# Service B - independent from Service A
service-b-tests:
  rules:
    - changes:
        paths:
          - services/service-b/**/*
          - shared-libs/**/*
        compare_to: 'refs/heads/main'
  script: cd services/service-b && npm test
```

#### Advanced: Different Comparisons for Different Branches
```yaml
terraform-plan:
  rules:
    # For production, compare to last production deploy
    - if: $CI_COMMIT_BRANCH == "main"
      changes:
        paths:
          - terraform/**/*
        compare_to: 'refs/heads/production'
    
    # For staging, compare to main
    - if: $CI_COMMIT_BRANCH == "staging"  
      changes:
        paths:
          - terraform/**/*
        compare_to: 'refs/heads/main'
```

#### Path Patterns and Globs
```yaml
docker-build:
  rules:
    - changes:
        paths:
          - Dockerfile            # Specific file
          - docker/**/*          # All files in docker/ directory
          - '**/*.dockerfile'    # Any .dockerfile in any directory
          - 'src/**/package.json' # Any package.json under src/
        compare_to: 'refs/heads/main'
```

#### Common Pitfalls & Solutions

**1. Empty Branch Problem**
```yaml
# Skip job if branch has no changes (saves resources)
job:
  rules:
    - if: $CI_COMMIT_BRANCH
      changes:
        compare_to: 'refs/heads/main'
        paths:
          - '**/*'  # Check if ANY file changed
```

**2. Forgetting paths with compare_to**
```yaml
# ❌ WRONG - compare_to requires paths
job:
  rules:
    - changes:
        - frontend/**/*
        compare_to: 'refs/heads/main'

# ✅ CORRECT
job:
  rules:
    - changes:
        paths:
          - frontend/**/*
        compare_to: 'refs/heads/main'
```

**3. Mixed Pipeline Types**
```yaml
# Handle both MR and branch pipelines correctly
build:
  rules:
    # MR pipeline - compares to target branch automatically
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes:
        - src/**/*
    
    # Branch pipeline - needs explicit compare_to
    - if: $CI_COMMIT_BRANCH
      changes:
        paths:
          - src/**/*
        compare_to: 'refs/heads/main'
```

## Cache vs Artifacts

| Aspect | Cache | Artifacts |
|--------|-------|-----------|
| **Purpose** | Speed up jobs by reusing dependencies | Pass build results between jobs |
| **Storage** | Runner's machine | GitLab server |
| **Availability** | Best effort, not guaranteed | Always available |
| **Sharing** | Between pipeline runs | Between jobs in same pipeline |
| **Expiration** | No automatic expiration | Configurable with `expire_in` |
| **Use Cases** | npm modules, pip packages, gems | Build outputs, test reports, logs |
| **Download** | Automatic if available | Via UI, API, or `dependencies` |

### When to Use Cache
✅ **Good for:**
- Package dependencies (node_modules, vendor/)
- Build tool caches (.gradle, .m2)
- Compilation caches

❌ **Useless when:**
- Runners don't share cache storage
- Cache key changes frequently
- Dependencies change often
- Different runner architectures

### When to Use Artifacts
✅ **Good for:**
- Build outputs needed by later jobs
- Test reports and coverage
- Deployment packages
- Debug logs

❌ **Avoid when:**
- Files are very large (use expire_in)
- Sensitive data (consider security)
- Temporary build files

## Cache Deep Dive

### Cache Key Strategies
```yaml
# Branch-specific cache
cache:
  key: $CI_COMMIT_REF_SLUG
  paths:
    - node_modules/

# File-based cache (updates when lockfile changes)
cache:
  key:
    files:
      - package-lock.json
  paths:
    - .npm/

# Fallback cache
cache:
  key:
    files:
      - package-lock.json
    prefix: $CI_COMMIT_REF_SLUG
  fallback_keys:
    - $CI_COMMIT_REF_SLUG
    - main
  paths:
    - node_modules/
```

### Cache Policies
```yaml
job:
  cache:
    policy: pull-push  # Default: download and upload
    # policy: pull     # Only download, don't update
    # policy: push     # Only upload, don't download
```

## Artifacts Deep Dive

### Basic Artifacts
```yaml
build:
  script: npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week
```

### Artifacts with Dependencies
```yaml
# Job A creates artifacts
build:
  stage: build
  script: make build
  artifacts:
    paths:
      - binaries/

# Job B uses Job A's artifacts
test:
  stage: test
  dependencies:
    - build  # Download artifacts from 'build' job
  script: ./test.sh binaries/

# Job C doesn't need artifacts
deploy:
  stage: deploy
  dependencies: []  # Don't download any artifacts
  script: echo "Deploy without artifacts"
```

### Using `needs` with Artifacts
```yaml
# More efficient than dependencies
unit-tests:
  needs:
    - job: build
      artifacts: true  # Download artifacts
  script: npm test

integration-tests:
  needs:
    - job: build
      artifacts: false  # Skip artifacts
  script: npm run test:integration
```

### Artifact Reports
```yaml
test:
  script: npm test
  artifacts:
    reports:
      junit: test-results.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml
```

## Advanced Topics Quick Reference

### needs vs dependencies
- `dependencies`: Downloads artifacts from jobs in previous stages
- `needs`: Creates DAG, can skip stages, more control over artifacts

```yaml
# Traditional stages approach
test:
  stage: test
  dependencies:
    - build  # Must wait for ALL build stage jobs

# DAG approach with needs
test:
  needs:
    - build-frontend  # Only wait for specific job
    - job: build-backend
      artifacts: false  # Don't download artifacts
```

### Parallel/Matrix Jobs
```yaml
test:
  parallel:
    matrix:
      - OS: [linux, macos, windows]
        NODE: [14, 16, 18]
  script: npm test
  # Creates 9 jobs: test: [linux, 14], test: [linux, 16], etc.
```

### Variable Timing
**Available at different phases:**
- **Pre-pipeline**: `CI_COMMIT_*`, project variables
- **Pipeline creation**: Most CI variables
- **Job execution only**: `CI_JOB_*`, job-specific variables

### Avoiding Duplicate Pipelines
**Problem**: Push to branch with open MR creates two pipelines

**Solution**: Use `workflow:rules` (shown above) or:
```yaml
job:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH && $CI_OPEN_MERGE_REQUESTS
      when: never
    - if: $CI_COMMIT_BRANCH
```

### Variable Precedence (highest to lowest)
1. Manual pipeline variables
2. Scheduled pipeline variables
3. Project/Group/Instance variables
4. Job variables
5. Pipeline variables
6. Deployment variables
7. Predefined CI variables

## Common Pitfalls

1. **Cache not working across runners**: Ensure runners share cache storage
2. **Artifacts too large**: Use `expire_in` and clean up old artifacts
3. **Rules not matching**: Remember first match wins, check your conditions
4. **Variables not available**: Check variable availability phase
5. **Duplicate pipelines**: Use proper `workflow:rules`
6. **DAG cycles**: `needs` cannot create circular dependencies

## Quick Debugging

```yaml
debug-variables:
  script:
    - echo "Pipeline Source: $CI_PIPELINE_SOURCE"
    - echo "Commit Branch: $CI_COMMIT_BRANCH"
    - echo "MR IID: $CI_MERGE_REQUEST_IID"
    - echo "Open MRs: $CI_OPEN_MERGE_REQUESTS"
  rules:
    - when: manual
      allow_failure: true
```