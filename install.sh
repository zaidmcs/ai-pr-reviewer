#!/usr/bin/env bash
set -euo pipefail

if [[ ${1:-} == "" ]]; then
  echo "Usage: install.sh <ACTION_REPO_SLUG> [languages]"
  echo "Example: install.sh zaidmcs/ai-pr-reviewer react"
  echo "Languages: react | laravel | auto (default: auto)"
  exit 1
fi

SLUG="$1"
LANGS="${2:-auto}"
RAW="https://raw.githubusercontent.com/${SLUG}/main/examples/workflows"
TARGET_DIR=".github/workflows"

mkdir -p "${TARGET_DIR}"

fetch_and_write() {
  local name="$1"
  curl -fsSL "${RAW}/${name}" | \
    sed "s#<OWNER>/ai-pr-reviewer#${SLUG}#g" | \
    sed "s#languages: auto#languages: ${LANGS}#g" > "${TARGET_DIR}/${name}"
  echo "✔ Installed ${TARGET_DIR}/${name}"
}

fetch_and_write "pr-review.yml"
fetch_and_write "comment-handler.yml"

echo
cat <<EOF
Next steps:
1) In GitHub → Settings → Secrets and variables → Actions → New repository secret
   - Name: GROQ_API_KEY
   - Value: your Groq API key (get one free at https://console.groq.com)
2) Commit and push these workflow files.
3) Open a PR to see the reviewer in action, and mention @ai-reviewer in PR comments to chat.
EOF
