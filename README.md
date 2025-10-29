# AI PR Reviewer Suppoert for (React , Laravel)

Reusable GitHub Actions that provide AI-powered PR reviews for React/JavaScript and Laravel/PHP.

Features
- React and Laravel reviewers in one action
- Choose language via input (react, laravel, or auto)
- Interactive PR comments via @ai-reviewer
- Uses free Groq API (llama-3.3-70b-versatile)

Quick start
1) Create secret GROQ_API_KEY in your repo (Settings → Secrets → Actions).
2) Add one of the example workflows from examples/workflows (or run installer below).

One-line install
curl -fsSL https://raw.githubusercontent.com/<OWNER>/ai-pr-reviewer/main/install.sh | bash -s -- <OWNER>/ai-pr-reviewer react
# or
curl -fsSL https://raw.githubusercontent.com/<OWNER>/ai-pr-reviewer/main/install.sh | bash -s -- <OWNER>/ai-pr-reviewer laravel
# or auto-detect
curl -fsSL https://raw.githubusercontent.com/<OWNER>/ai-pr-reviewer/main/install.sh | bash -s -- <OWNER>/ai-pr-reviewer auto

Usage (PR review)
- Auto-detect:
  uses: <OWNER>/ai-pr-reviewer/review@v1
  with:
    languages: auto
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
    GITHUB_REPOSITORY: ${{ github.repository }}
    GITHUB_SHA: ${{ github.event.pull_request.head.sha }}

- Explicit (React only):
  uses: <OWNER>/ai-pr-reviewer/review@v1
  with:
    languages: react
  env: {...}

- Explicit (Laravel only):
  uses: <OWNER>/ai-pr-reviewer/review@v1
  with:
    languages: laravel
  env: {...}

Usage (interactive comments)
- Auto/React/Laravel with same languages input
  uses: <OWNER>/ai-pr-reviewer/comment@v1
  with:
    languages: react      # or laravel or auto
    comment_body: ${{ github.event.comment.body }}
    pr_number: ${{ github.event.issue.number }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
    GITHUB_REPOSITORY: ${{ github.repository }}
    GITHUB_SHA: ${{ github.sha }}

Notes
- Tag a release (v1) after pushing so consumers can pin it.
- Auto mode inspects changed files: JS/TS → React, PHP → Laravel (runs both if both are present).
