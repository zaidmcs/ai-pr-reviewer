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

/**
 * Call Groq AI with strict instructions for accuracy
 */
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
            content: `You are a Laravel/PHP security and correctness expert. Your job is to find ONLY critical bugs.

STRICT RULES:
1. Only report issues you are 100% certain about
2. Focus ONLY on: SQL injection, XSS, authentication bypass, data loss, logic errors, syntax errors
3. Do NOT comment on: style, naming, formatting, refactoring, best practices
4. If you see partial code and cannot determine if it's a real issue, DO NOT report it
5. Verify the issue exists in the PROVIDED code, not assumptions

FORMAT (must follow exactly):
CRITICAL: (list only definite bugs, or write "None")
- Line X: [Brief description]

SUGGESTIONS: (optional improvements, max 20 or write "None")
- Line X: [Brief description]

If nothing found, respond with:
CRITICAL: None
SUGGESTIONS: None`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 800,
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

/**
 * Check Laravel/PHP best practices
 */
function checkBestPractices(content, filename) {
  const suggestions = [];
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return;
    }

    // 1. Use Query Builder or Eloquent instead of raw queries
    if (/DB::select\s*\(\s*['"]SELECT/.test(line) && !/DB::select\s*\(\s*['"]SELECT[^'"]*\?/.test(line)) {
      suggestions.push({
        line: lineNum,
        category: '📊 Database',
        message: 'Consider using Query Builder or Eloquent instead of raw SQL for better maintainability'
      });
    }

    // 2. Use route model binding
    if (/function\s+\w+\s*\([^)]*\$id\s*[,)]/.test(line) && /Controller/.test(content)) {
      const nextLines = lines.slice(idx, idx + 5).join('\n');
      if (/::find\s*\(\s*\$id\s*\)/.test(nextLines)) {
        suggestions.push({
          line: lineNum,
          category: '🎯 Eloquent',
          message: 'Use route model binding instead of manual find($id) for cleaner code'
        });
      }
    }

    // 3. Use Form Request for validation
    if (/\$request->validate\s*\(\s*\[/.test(line) && /Controller/.test(content)) {
      suggestions.push({
        line: lineNum,
        category: '✅ Validation',
        message: 'Consider using Form Request classes for complex validations to keep controllers thin'
      });
    }

    // Additional suggestions from original code truncated for brevity...
  });

  return suggestions;
}

/**
 * High-precision static analysis - only 100% certain issues
 */
function analyzeCode(content, filename) {
  // Skip files that shouldn't be reviewed
  if (
    /\b(vendor|node_modules|bootstrap\/cache|storage)\b/.test(filename) ||
    /\.blade\.php$/.test(filename) ||
    /\/(tests?|Tests)\//i.test(filename) ||
    /_test\.php$|Test\.php$/.test(filename)
  ) {
    return { critical: [], suggestions: [] };
  }

  const critical = [];
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return;
    }

    // 1. Debug functions (100% certain)
    if (/\b(dd|dump)\s*\(/.test(line)) {
      critical.push({
        line: lineNum,
        type: '🔍 Debug Code',
        severity: 'critical',
        message: 'Debug function dd() or dump() must be removed before merge'
      });
    }

    // 2. SQL injection with variable concatenation (high confidence)
    if (/DB::raw\([^)]*['"][^'"]*\$/.test(line) || /->whereRaw\([^)]*['"][^'"]*\$/.test(line)) {
      // Check if it's string concatenation
      if (/['"].*\..*\$/.test(line) || /\$.*\..*['"]/.test(line)) {
        critical.push({
          line: lineNum,
          type: '🔒 Security',
          severity: 'critical',
          message: 'SQL injection risk: variable concatenated in raw query. Use parameter binding with ?'
        });
      }
    }

    // 3. Mass assignment with all() (100% certain vulnerability)
    if (/::create\s*\(\s*\$request\s*->\s*all\s*\(\s*\)/.test(line)) {
      critical.push({
        line: lineNum,
        type: '🔒 Security',
        severity: 'critical',
        message: 'Mass assignment vulnerability: $request->all() allows any field. Use validated() or only()'
      });
    }

    // Additional critical checks from original code truncated for brevity...
  });

  // Get best practice suggestions
  const suggestions = checkBestPractices(content, filename);

  return { critical, suggestions };
}

/**
 * Get PR files
 */
async function getPRDiff() {
  try {
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: PR_NUMBER,
    });

    const phpFiles = files.filter(f => 
      /\.php$/.test(f.filename) && 
      f.status !== 'removed' &&
      !f.filename.includes('vendor/') &&
      !f.filename.includes('node_modules/')
    );

    return phpFiles;
  } catch (error) {
    console.error('Error fetching PR files:', error.message);
    return [];
  }
}

/**
 * Post review comment
 */
async function postReviewComment(body) {
  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: PR_NUMBER,
      body,
    });
    console.log('✅ Posted Laravel review comment');
  } catch (error) {
    console.error('Error posting comment:', error.message);
  }
}

/**
 * Main review function
 */
async function reviewPR() {
  if (!PR_NUMBER) {
    console.log('❌ Not a PR event');
    return;
  }

  console.log(`🔍 Reviewing Laravel PR #${PR_NUMBER}...`);

  const files = await getPRDiff();
  
  if (files.length === 0) {
    console.log('ℹ️ No PHP files changed');
    return;
  }

  console.log(`📝 Found ${files.length} PHP files to review`);

  let allCritical = [];
  let allSuggestions = [];
  let aiReviews = [];

  // Process each file
  for (const file of files.slice(0, 8)) {
    console.log(`   📄 ${file.filename}`);
    
    try {
      // Get file content
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: file.filename,
        ref: process.env.GITHUB_SHA,
      });

      const content = Buffer.from(fileData.content, 'base64').toString('utf8');
      
      // Static analysis
      const { critical, suggestions } = analyzeCode(content, file.filename);
      
      if (critical.length > 0) {
        allCritical.push({ file: file.filename, issues: critical });
      }
      
      if (suggestions.length > 0) {
        allSuggestions.push({ file: file.filename, suggestions });
      }

      // AI review (only for files with patches)
      if (GROQ_API_KEY && file.patch && file.patch.length > 50) {
        const patchPreview = file.patch.slice(0, 3000);
        const prompt = `File: ${file.filename}

Code changes:
\`\`\`diff
${patchPreview}
\`\`\`

Review ONLY the changed lines above. Report only if you are 100% certain of a critical security or correctness bug.`;

        const aiReview = await callGroqAI(prompt);
        
        // Only include AI review if it found actual issues
        if (aiReview && !aiReview.includes('None') && !aiReview.includes('No issues')) {
          aiReviews.push({ file: file.filename, review: aiReview });
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`   ❌ Error processing ${file.filename}:`, error.message);
    }
  }

  // Build comment
  let comment = '## 🤖 Laravel Security Review\n\n';

  const hasCritical = allCritical.length > 0;
  if (hasCritical) {
    const totalCritical = allCritical.reduce((sum, f) => sum + f.issues.length, 0);
    comment += `⛔ **Found ${totalCritical} CRITICAL issue(s) that must be fixed before merge**\n\n`;
  }

  // Critical issues
  if (allCritical.length > 0) {
    comment += '### ⛔ Critical Issues\n\n';
    allCritical.forEach(({ file, issues }) => {
      comment += `#### 📄 ${file}\n`;
      issues.forEach(issue => {
        comment += `- **Line ${issue.line}**: ${issue.message}\n`;
      });
      comment += '\n';
    });
  }

  // AI reviews
  if (aiReviews.length > 0) {
    comment += '### 🧠 AI Deep Analysis\n\n';
    aiReviews.forEach(({ file, review }) => {
      comment += `<details><summary>📄 ${file}</summary>\n\n${review}\n\n</details>\n\n`;
    });
  }

  if (allCritical.length === 0 && aiReviews.length === 0) {
    comment += '✅ **No security or critical issues detected**\n\n';
    comment += 'Code review passed automated checks.\n\n';
  }

  comment += '\n---\n*💬 Ask questions with `@ai-reviewer [your question]` in comments*';

  await postReviewComment(comment);

  // Fail only on critical issues
  if (hasCritical) {
    console.log('⛔ Review FAILED: critical issues found');
    process.exitCode = 1;
  } else {
    console.log('✅ Review PASSED: no critical issues');
  }
}

// Run
reviewPR().catch(err => {
  console.error(err);
  process.exitCode = 1;
});