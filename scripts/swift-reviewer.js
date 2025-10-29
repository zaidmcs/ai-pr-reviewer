#!/usr/bin/env node
const { Octokit } = require('@octokit/rest');
const fs = require('fs');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.GITHUB_EVENT_PATH 
  ? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).pull_request?.number
  : null;

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const [owner, repo] = process.env.GITHUB_REPOSITORY?.split('/') || ['', ''];

async function callGroqAI(prompt) {
  if (!GROQ_API_KEY) {
    console.log('⚠️ GROQ_API_KEY not set - skipping AI analysis');
    return null;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a Swift/iOS expert reviewer (Swift 5.7+, iOS 15+).
Focus on:
1) Safety: avoid force unwraps (!), force casts (as!), force try (try!)
2) Memory: retain cycles in closures; use [weak self] when appropriate
3) Concurrency: prefer async/await; ensure UI updates on main thread
4) API usage: modern Swift, Codable, error handling
Report only definite issues. Format:
CRITICAL: ... or "None"
SUGGESTIONS: ... or "None"`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.15,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      console.error(`Groq API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('Error calling Groq:', error.message);
    return null;
  }
}

function analyzeCode(content, filename) {
  // Skip generated/vendor/test code
  if (/\b(Pods|Carthage|\.build|DerivedData|fastlane)\b/.test(filename) ||
      /\/(Tests|UITests)\//.test(filename)) {
    return { critical: [], suggestions: [] };
  }

  const critical = [];
  const suggestions = [];
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const n = idx + 1;
    const t = line.trim();
    if (!t || t.startsWith('//')) return;

    // Critical: force try
    if (/\btry!\b/.test(t)) {
      critical.push({ line: n, type: '⚠️ Force Try', message: 'Avoid try! — handle errors with do/catch or try?' });
    }

    // Critical: force cast
    if (/\bas!\b/.test(t)) {
      critical.push({ line: n, type: '⚠️ Force Cast', message: 'Avoid as! — use as? with safe handling' });
    }

    // Critical: obvious force unwrap patterns var!
    if (/\w!\b/.test(t) && !/!=/.test(t) && !/^!/.test(t)) {
      suggestions.push({ line: n, category: 'Safety', message: 'Avoid force unwrapping (!). Use if let/guard let or nil coalescing' });
    }

    // Suggest: retain cycle risk (closure with self. without weak)
    if (/\{\s*\[.*\]\s*in/.test(t) === false && /\{[^}]*in/.test(t)) {
      const window = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 8)).join('\n');
      if (/self\./.test(window) && !/\[weak\s+self\]/.test(window) && /class\s+\w+/.test(content)) {
        suggestions.push({ line: n, category: 'Memory', message: 'Consider [weak self] in closures to avoid retain cycles' });
      }
    }

    // Suggest: print/log in production
    if (/\bprint\s*\(/.test(t)) {
      suggestions.push({ line: n, category: 'Cleanliness', message: 'Remove print() or gate behind DEBUG' });
    }

    // Suggest: TODO/FIXME present
    if (/\b(TODO|FIXME)\b/.test(t)) {
      suggestions.push({ line: n, category: 'Maintenance', message: 'Address TODO/FIXME before merge' });
    }

    // Suggest: UI update ensure main thread
    if (/\.(text|setNeedsLayout|reloadData|setNeedsDisplay)\b/.test(t) && /DispatchQueue\.global/.test(lines.slice(Math.max(0, idx-5), idx+1).join('\n'))) {
      suggestions.push({ line: n, category: 'Concurrency', message: 'UI updates must be on main thread (DispatchQueue.main.async)' });
    }

    // Suggest: large function indicator
    // if function spans > 80 lines (rough heuristic)
  });

  return { critical, suggestions };
}

async function getPRFiles() {
  try {
    const { data: files } = await octokit.pulls.listFiles({ owner, repo, pull_number: PR_NUMBER });
    return files.filter(f => /\.swift$/.test(f.filename) && f.status !== 'removed' &&
      !/Pods\//.test(f.filename) && !/Carthage\//.test(f.filename) && !/\.build\//.test(f.filename) && !/DerivedData\//.test(f.filename));
  } catch (e) {
    console.error('Error fetching PR files:', e.message);
    return [];
  }
}

async function postReviewComment(body) {
  try {
    await octokit.issues.createComment({ owner, repo, issue_number: PR_NUMBER, body });
    console.log('✅ Posted review comment');
  } catch (e) { console.error('Error posting comment:', e); }
}

async function reviewPR() {
  if (!PR_NUMBER) { console.log('❌ Not a PR event'); return; }
  console.log(`🔍 Reviewing Swift PR #${PR_NUMBER}...`);

  const files = await getPRFiles();
  if (files.length === 0) { console.log('ℹ️ No Swift files changed'); return; }

  let allCritical = [];
  let allSuggestions = [];
  let aiReviews = [];

  for (const file of files.slice(0, 10)) {
    console.log(`   📄 ${file.filename}`);
    try {
      const { data: fileData } = await octokit.repos.getContent({ owner, repo, path: file.filename, ref: process.env.GITHUB_SHA });
      const content = Buffer.from(fileData.content, 'base64').toString('utf8');

      const { critical, suggestions } = analyzeCode(content, file.filename);
      if (critical.length) allCritical.push({ file: file.filename, issues: critical });
      if (suggestions.length) allSuggestions.push({ file: file.filename, suggestions });

      if (GROQ_API_KEY && file.patch && file.patch.length > 50) {
        const patchPreview = file.patch.slice(0, 3000);
        const prompt = `File: ${file.filename}\n\nChanged lines:\n\`\`\`diff\n${patchPreview}\n\`\`\`\n\nReview only the diff above. Report definite issues (safety, memory, concurrency).`;
        const ai = await callGroqAI(prompt);
        if (ai && !/None/i.test(ai)) aiReviews.push({ file: file.filename, review: ai });
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (e) {
      console.error(`   ❌ Error processing ${file.filename}:`, e.message);
    }
  }

  const hasCritical = allCritical.length > 0;
  const totalCritical = allCritical.reduce((s, f) => s + f.issues.length, 0);

  let comment = '## 🍎 Swift/iOS Code Review\n\n';
  if (hasCritical) comment += `⛔ **Found ${totalCritical} CRITICAL issue(s) that must be fixed**\n\n`;

  if (allCritical.length) {
    comment += '### ⛔ Critical Issues\n\n';
    allCritical.forEach(({ file, issues }) => {
      comment += `#### 📄 ${file}\n`;
      issues.forEach(i => { comment += `- **Line ${i.line}** [${i.type}]: ${i.message}\n`; });
      comment += '\n';
    });
  }

  if (aiReviews.length) {
    comment += '### 🧠 AI Deep Analysis\n\n';
    aiReviews.forEach(({ file, review }) => { comment += `<details><summary>📄 ${file}</summary>\n\n${review}\n\n</details>\n\n`; });
  }

  if (allSuggestions.length) {
    comment += '### 💡 Suggestions\n\n';
    allSuggestions.forEach(({ file, suggestions }) => {
      suggestions.forEach(s => { comment += `- **${file}:${s.line}** - ${s.category}: ${s.message}\n`; });
    });
    comment += '\n';
  }

  if (!hasCritical && aiReviews.length === 0) {
    comment += '✅ **No critical issues detected**\n\n';
  }

  comment += '---\n*💬 Ask questions with `@ai-reviewer [your question]`*';

  await postReviewComment(comment);

  process.exitCode = hasCritical ? 1 : 0;
}

reviewPR().catch(err => { console.error(err); process.exitCode = 1; });
