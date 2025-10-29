<div align="center">

# 🤖 AI PR Reviewer

Reusable GitHub Actions for automatic, AI‑powered code reviews in React/JavaScript, Laravel/PHP, and Swift/iOS.

<a href="https://github.com/zaidmcs/ai-pr-reviewer"><img alt="version" src="https://img.shields.io/github/v/tag/zaidmcs/ai-pr-reviewer?label=version&sort=semver"></a>
<a href="#license"><img alt="license" src="https://img.shields.io/badge/License-MIT-green.svg"></a>
<img alt="stacks" src="https://img.shields.io/badge/Stacks-React%20%2B%20Laravel%20%2B%20Swift-blueviolet">
<img alt="gh actions" src="https://img.shields.io/badge/GitHub%20Actions-Ready-2088FF?logo=github%20actions&logoColor=white">

<p>
  ⚡ Zero setup • 🔍 Static checks • 🧠 AI deep review • 💬 Interactive PR chat
</p>

</div>

---

- ✨ One action for multiple stacks: React + Laravel + Swift
- 🧑‍💻 Beginner‑friendly: copy–paste two small workflow files
- 🆓 Free to run: uses Groq’s free API; no GitHub App required
- 🔒 Private by default: only PR diffs are sent to the AI API

Quick links
- 👉 Install now
- ⚙️ Usage
- ❓ FAQ
- 🔐 Privacy
- 🤝 Contributing

## 🚀 Quick Start (2 minutes)
1) Create a secret `GROQ_API_KEY` in your repo (Settings → Secrets and variables → Actions → New repository secret).
2) Install the workflows automatically:

Primary (CDN):
```bash path=null start=null
curl -fsSL https://cdn.jsdelivr.net/gh/zaidmcs/ai-pr-reviewer@main/install.sh | bash -s -- zaidmcs/ai-pr-reviewer auto
```

Fallback (GitHub CLI):
```bash path=null start=null
gh api repos/zaidmcs/ai-pr-reviewer/contents/install.sh -H 'Accept: application/vnd.github.v3.raw' | bash -s -- zaidmcs/ai-pr-reviewer auto
```

3) Open a PR. You’ll get an automated review comment. Mention `@ai-reviewer` in PR comments to ask follow‑ups.

## 🧩 Language selection
- Auto (default): detects changed files and runs React reviewer for JS/TS, Laravel reviewer for PHP, and Swift reviewer for .swift
- React only: set `languages: react`
- Laravel only: set `languages: laravel`
- Swift only: set `languages: swift`

## 📦 Usage (copy–paste)
Add this to `.github/workflows/pr-review.yml`:

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

Add this to `.github/workflows/comment-handler.yml`:

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

## 💡 What you get
- ⚛️ React: hooks and performance checks, JSX pitfalls, accessibility, modern JS tips
- 🌙 Laravel: security (SQLi/XSS), correctness, mass‑assignment, transactions, error handling
- 🍎 Swift: safety (force unwrap/cast/try), retain cycles, main‑thread UI, async/await, error handling
- 🧠 AI deep analysis on changed lines only
- 🗂️ One comment summarizing critical issues and grouped suggestions
- 💬 Interactive Q&A in PR comments via `@ai-reviewer`

> Tip: Use `languages: react,laravel,swift` to force all reviewers on mono‑repos.

## ⚙️ Configuration
- Action: `zaidmcs/ai-pr-reviewer/review@v1`
  - inputs.languages: `auto` | `react` | `laravel` | `swift` (default: `auto`)
  - env.GROQ_API_KEY: your Groq API key
  - env.GITHUB_TOKEN: provided by GitHub Actions `${{ secrets.GITHUB_TOKEN }}`
- Action: `zaidmcs/ai-pr-reviewer/comment@v1`
  - inputs.languages: same as above
  - inputs.comment_body: `${{ github.event.comment.body }}`
  - inputs.pr_number: `${{ github.event.issue.number }}`

## 🔑 Get a free Groq API key
- Go to https://console.groq.com → API Keys → Create key
- Add it as `GROQ_API_KEY` in your repo’s Actions secrets

## 🧰 Troubleshooting
- No comment on PR: check Actions logs for the “AI PR Review” workflow; ensure `GROQ_API_KEY` is set
- `@ai-reviewer` not responding: verify the comment workflow ran and that you commented on a PR (not an issue)
- Rate limits: if the AI call is skipped, static checks still run and post a comment
- curl 429 on install: use the CDN command above or the GitHub CLI fallback

## 🔐 Privacy & Security
- No GitHub App required; runs entirely in your repository’s Actions
- Only PR diffs and small snippets are sent to the AI API
- Groq states user prompts are not used to train their models

## ❓ FAQ
- Does it block merges? It exits non‑zero only when critical issues are found, so you can make it required if you want
- Can I customize rules? Yes—open an issue or PR; per‑stack rule sets live in `scripts/`
- Other languages? Open an issue to request a reviewer (Node backends, Python, etc.)

## 🤝 Contributing
PRs welcome. Please open an issue to discuss larger changes first.

## 📄 License
MIT
