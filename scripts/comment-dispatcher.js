#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('fs');

function parseLanguages(input) {
  if (!input || input.trim() === '' || input.trim().toLowerCase() === 'auto') return ['auto'];
  return input.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function runScript(name) {
  const scriptMap = {
    react: `${__dirname}/react-comment-handler.js`,
    laravel: `${__dirname}/comment-handler-laravel.js`,
  };
  const path = scriptMap[name];
  if (!path) return 0;
  const res = spawnSync('node', [path], { stdio: 'inherit', env: process.env });
  return res.status || 0;
}

(async () => {
  const langs = parseLanguages(process.env.LANGUAGES || 'auto');

  let toRun = langs;
  if (langs.includes('auto')) {
    // In auto mode, run both; handlers are cheap and will tailor context
    toRun = ['react', 'laravel'];
  }

  let posted = false;
  let exit = 0;
  for (const lang of toRun) {
    console.log(`▶ Handling comment for: ${lang}`);
    const code = runScript(lang);
    // attempt both; do not fail if one is missing context
    if (code === 0) posted = true;
    if (code !== 0) exit = code;
  }
  process.exitCode = exit;
})();
