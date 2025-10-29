#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('fs');

function parseLanguages(input) {
  if (!input || input.trim() === '' || input.trim().toLowerCase() === 'auto') return ['auto'];
  return input.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function detectLanguagesFromPR() {
  try {
    const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : null;
    const prNumber = event?.pull_request?.number;
    if (!prNumber) return [];

    // Basic detection by env diff via GitHub API is inside scripts; here we do a heuristic by repo tree later
    // Keep it simple: let each reviewer filter its own files. Just return both to cover cases.
    return ['react', 'laravel'];
  } catch {
    return [];
  }
}

function runScript(name) {
  const scriptMap = {
    react: `${__dirname}/react-reviewer.js`,
    laravel: `${__dirname}/laravel-reviewer.js`,
  };
  const path = scriptMap[name];
  if (!path) return 0;
  const res = spawnSync('node', [path], { stdio: 'inherit', env: process.env });
  return res.status || 0;
}

(async () => {
  const langsInput = parseLanguages(process.env.LANGUAGES || 'auto');
  let toRun = langsInput.includes('auto') ? detectLanguagesFromPR() : langsInput;
  if (toRun.length === 0) toRun = ['react'];

  let fail = 0;
  for (const lang of toRun) {
    console.log(`▶ Running reviewer for: ${lang}`);
    const code = runScript(lang);
    if (code !== 0) fail = code;
  }
  process.exitCode = fail;
})();
