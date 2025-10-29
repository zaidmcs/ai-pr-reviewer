# AI PR Reviewer Suppoert for (React , Laravel)

Drop-in GitHub Actions that review your pull requests automatically with static checks and AI (React/JS and Laravel/PHP). No apps to install.

Why use this
- One action for multiple stacks: React + Laravel
- Beginner-friendly: copy–paste two small workflows
- Free to run: uses Groq’s free API; no third‑party GitHub App
- Private by default: only PR diffs are sent to the AI API

Quick start (2 minutes)
1) Create a secret GROQ_API_KEY in your repo (Settings → Secrets and variables → Actions → New repository secret)
2) Install the workflows automatically:

```bash path=null start=null
curl -fsSL https://raw.githubusercontent.com/zaidmcs/ai-pr-reviewer/main/install.sh | bash -s -- zaidmcs/ai-pr-reviewer auto
```

3) Open a PR. You’ll get an automated review comment. Mention `@ai-reviewer` in PR comments to ask follow‑ups.

Choose your language(s)
- Auto (default): detects changed files and runs React reviewer for JS/TS and Laravel reviewer for PHP
- React only: set `languages: react`
- Laravel only: set `languages: laravel`

Manual setup (copy–paste)
Add this to .github/workflows/pr-review.yml:

```yaml path=null start=null
name: AI PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run AI reviewer
        uses: zaidmcs/ai-pr-reviewer/review@v1
        with:
          languages: auto   # or react | laravel
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          GITHUB_REPOSITORY: ${{ github.repository }}
          GITHUB_SHA: ${{ github.event.pull_request.head.sha }}
```

Add this to .github/workflows/comment-handler.yml:

```yaml path=null start=null
name: AI Interactive Comments

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  handle-comment:
    if: |
      github.event.issue.pull_request &&
      contains(github.event.comment.body, '@ai-reviewer')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Handle AI reviewer mention
        uses: zaidmcs/ai-pr-reviewer/comment@v1
        with:
          languages: auto   # or react | laravel
          comment_body: ${{ github.event.comment.body }}
          pr_number: ${{ github.event.issue.number }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          GITHUB_REPOSITORY: ${{ github.repository }}
          GITHUB_SHA: ${{ github.sha }}
```

What you get
- Static analysis tuned for each stack (React best practices; Laravel security and correctness)
- AI deep analysis on changed lines only
- One comment summarizing critical issues and grouped suggestions
- Interactive Q&A in PR comments via `@ai-reviewer`

Configuration reference
- Action: `zaidmcs/ai-pr-reviewer/review@v1`
  - inputs.languages: `auto` | `react` | `laravel` (default: `auto`)
  - env.GROQ_API_KEY: your Groq API key
  - env.GITHUB_TOKEN: provided by GitHub Actions `${{ secrets.GITHUB_TOKEN }}`
- Action: `zaidmcs/ai-pr-reviewer/comment@v1`
  - inputs.languages: same as above
  - inputs.comment_body: `${{ github.event.comment.body }}`
  - inputs.pr_number: `${{ github.event.issue.number }}`

Get a free Groq API key
- Go to https://console.groq.com → API Keys → Create key
- Add it as `GROQ_API_KEY` in your repo’s Actions secrets

Troubleshooting
- No comment on PR: check Actions logs for the “AI PR Review” workflow; ensure `GROQ_API_KEY` is set
- `@ai-reviewer` not responding: verify the comment workflow ran and that you commented on a PR (not an issue)
- Rate limits: if the AI call is skipped, static checks still run and post a comment

Privacy & security
- No GitHub App required; runs entirely in your repository’s Actions
- Only PR diffs and small snippets are sent to the AI API
- Groq states user prompts are not used to train their models

FAQ
- Does it block merges? It exits non‑zero only when critical issues are found, so you can make it required if you want
- Can I customize rules? Yes—open an issue or PR; per‑stack rule sets live in `scripts/`
- Other languages? Open an issue to request a reviewer (Node backends, Python, etc.)

Contributing
PRs welcome. Please open an issue to discuss larger changes first.

License
MIT
