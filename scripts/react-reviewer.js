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
 * Call Groq AI with updated React/JS expertise
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
            content: `You are a React/JavaScript expert (2024-2025 standards). Focus on:

MODERN REACT (Post-2023):
- React 18+ features: useTransition, useDeferredValue, Server Components
- Hooks best practices (useState, useEffect, useMemo, useCallback)
- AVOID outdated patterns: class components, componentDidMount (unless legacy code)

CRITICAL ISSUES TO FIND:
1. Security: XSS, injection vulnerabilities, unsafe patterns
2. Performance: unnecessary re-renders, missing memoization, large bundles
3. Logic errors: infinite loops, race conditions, memory leaks
4. Syntax errors and runtime crashes

DO NOT REPORT:
- Styling preferences, naming conventions
- Minor refactoring suggestions
- Subjective improvements

FORMAT:
CRITICAL: (definite bugs only, or "None")
- Line X: [Brief description]

SUGGESTIONS: (performance/best practices, or "None")
- Line X: [Brief description]`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
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
 * Check React/JavaScript best practices with modern standards
 */
function checkBestPractices(content, filename) {
  const suggestions = [];
  const lines = content.split('\n');
  const isTypeScript = /\.tsx?$/.test(filename);
  const isComponent = /^[A-Z]/.test(filename.split('/').pop().replace(/\.(jsx?|tsx?)$/, ''));

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || /^(\/\/|\/\*|\*)/.test(trimmed)) {
      return;
    }

    // 1. Use functional components (modern React)
    if (/class\s+\w+\s+extends\s+(?:React\.)?Component/.test(line)) {
      suggestions.push({
        line: lineNum,
        category: '⚛️ Modern React',
        message: 'Consider using functional components with hooks instead of class components (React 16.8+)',
        priority: 'high'
      });
    }

    // 2. Missing dependency array in useEffect
    if (/useEffect\s*\(\s*\(\s*\)\s*=>/.test(line)) {
      const effectContent = lines.slice(idx, idx + 15).join('\n');
      if (!/\}\s*,\s*\[/.test(effectContent)) {
        suggestions.push({
          line: lineNum,
          category: '🪝 Hooks',
          message: 'useEffect without dependency array runs on every render. Add [] for mount-only or specify dependencies',
          priority: 'high'
        });
      }
    }

    // 3. Inline function in JSX (performance)
    if (/(?:onClick|onChange|onSubmit|on[A-Z]\w*)\s*=\s*\{(?:\(\)|.*=>)/.test(line)) {
      suggestions.push({
        line: lineNum,
        category: '⚡ Performance',
        message: 'Inline function creates new reference on each render. Use useCallback or extract to stable reference',
        priority: 'medium'
      });
    }

    // 4. Missing key prop in map
    if (/\.map\s*\(/.test(line)) {
      const mapContent = lines.slice(idx, idx + 5).join('\n');
      if (/<[A-Z]/.test(mapContent) && !/key\s*=/.test(mapContent)) {
        suggestions.push({
          line: lineNum,
          category: '⚛️ React',
          message: 'Missing key prop in list. Add unique key to help React identify items',
          priority: 'high'
        });
      }
    }

    // 5. Using index as key (anti-pattern)
    if (/key\s*=\s*\{.*index\}/.test(line)) {
      suggestions.push({
        line: lineNum,
        category: '⚛️ React',
        message: 'Avoid using array index as key. Use unique ID if items can be reordered or filtered',
        priority: 'medium'
      });
    }

    // 6. Console.log in production code
    if (/console\.(log|debug|info)\s*\(/.test(line)) {
      suggestions.push({
        line: lineNum,
        category: '🧹 Code Quality',
        message: 'Remove console.log before production. Use proper logging library or remove debug statements',
        priority: 'medium'
      });
    }

    // 7. Async operations without cleanup
    if (/useEffect/.test(line)) {
      const effectContent = lines.slice(idx, idx + 20).join('\n');
      if (/(fetch|axios|setTimeout|setInterval|subscribe)\s*\(/.test(effectContent)) {
        if (!/return\s*\(\s*\)\s*=>/.test(effectContent) && !/return\s+function/.test(effectContent)) {
          suggestions.push({
            line: lineNum,
            category: '🐛 Memory Leaks',
            message: 'useEffect with async operations should return cleanup function to prevent memory leaks',
            priority: 'high'
          });
        }
      }
    }

    // 8. Prefer optional chaining
    if (/\w+\s*&&\s*\w+\.\w+/.test(line) && !trimmed.startsWith('//')) {
      suggestions.push({
        line: lineNum,
        category: '🎯 Modern JS',
        message: 'Use optional chaining (?.) instead of && for safer property access',
        priority: 'low'
      });
    }

    // 9. Fetch without error handling
    if (/fetch\s*\(/.test(line) || /axios\.\w+\s*\(/.test(line)) {
      const fetchContext = lines.slice(idx, idx + 10).join('\n');
      if (!/catch|try/.test(fetchContext)) {
        suggestions.push({
          line: lineNum,
          category: '🐛 Error Handling',
          message: 'API call without error handling. Add try-catch or .catch() to handle failures',
          priority: 'high'
        });
      }
    }

    // 10. Heavy computation in render
    if (/(\.filter|\.map|\.reduce|\.sort)\s*\(.*\)\s*\.\s*(filter|map|reduce|sort)/.test(line)) {
      suggestions.push({
        line: lineNum,
        category: '⚡ Performance',
        message: 'Chained array operations in render. Consider using useMemo to cache computed values',
        priority: 'medium'
      });
    }

    // 11. Use lazy loading for routes
    if (/import\s+\w+\s+from\s+['"].*\/(?:pages|routes|views)\//.test(line)) {
      if (!/React\.lazy|lazy\(/.test(line)) {
        suggestions.push({
          line: lineNum,
          category: '⚡ Performance',
          message: 'Consider lazy loading route components with React.lazy() to reduce initial bundle size',
          priority: 'medium'
        });
      }
    }

    // 12. Missing alt text on images
    if (/<img\s/.test(line) && !/alt\s*=/.test(line)) {
      suggestions.push({
        line: lineNum,
        category: '♿ Accessibility',
        message: 'Images must have alt text for accessibility. Add descriptive alt attribute',
        priority: 'high'
      });
    }

    // 13. Prefer const over let
    if (/^\s*let\s+\w+\s*=/.test(line)) {
      const varName = line.match(/let\s+(\w+)/)[1];
      const scopeContent = lines.slice(idx, idx + 30).join('\n');
      if (!new RegExp(`\\b${varName}\\s*=`).test(scopeContent.slice(line.length))) {
        suggestions.push({
          line: lineNum,
          category: '🎯 Modern JS',
          message: `Variable '${varName}' is never reassigned. Use 'const' instead of 'let'`,
          priority: 'low'
        });
      }
    }

    // 14. Use semantic HTML
    if (/<div\s+(?:onClick|role=["']button)/.test(line)) {
      suggestions.push({
        line: lineNum,
        category: '♿ Accessibility',
        message: 'Use semantic HTML <button> instead of <div> with onClick for better accessibility',
        priority: 'medium'
      });
    }

    // 15. Form without onSubmit handler
    if (/<form/.test(line) && !/onSubmit/.test(line)) {
      const formContent = lines.slice(idx, idx + 5).join('\n');
      if (!/onSubmit/.test(formContent)) {
        suggestions.push({
          line: lineNum,
          category: '🐛 Forms',
          message: 'Form without onSubmit handler. Add handler and preventDefault() to control submission',
          priority: 'medium'
        });
      }
    }
  });

  return suggestions;
}

/**
 * High-precision static analysis for critical issues
 */
function analyzeCode(content, filename) {
  // Skip node_modules, build files, etc.
  if (
    /node_modules|dist|build|coverage|\.min\.js/.test(filename) ||
    /\.(test|spec)\.(jsx?|tsx?)$/.test(filename)
  ) {
    return { critical: [], suggestions: [] };
  }

  const critical = [];
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    if (!trimmed || /^(\/\/|\/\*|\*)/.test(trimmed)) {
      return;
    }

    // 1. Dangerous innerHTML usage (XSS risk)
    if (/dangerouslySetInnerHTML/.test(line)) {
      critical.push({
        line: lineNum,
        type: '🔒 Security',
        severity: 'critical',
        message: 'XSS risk: dangerouslySetInnerHTML can inject malicious scripts. Sanitize HTML with DOMPurify'
      });
    }

    // 2. Direct DOM manipulation (anti-pattern)
    if (/document\.(getElementById|querySelector|getElementsBy)/.test(line)) {
      critical.push({
        line: lineNum,
        type: '⚛️ React',
        severity: 'critical',
        message: 'Avoid direct DOM manipulation in React. Use refs (useRef) or state instead'
      });
    }

    // 3. Infinite loop in useEffect
    if (/useEffect\s*\(/.test(line)) {
      const effectContent = lines.slice(idx, idx + 15).join('\n');
      if (/set[A-Z]\w*\s*\(/.test(effectContent) && !/\]\s*\)/.test(effectContent)) {
        critical.push({
          line: lineNum,
          type: '🐛 Infinite Loop',
          severity: 'critical',
          message: 'Potential infinite loop: useEffect updates state without dependency array'
        });
      }
    }

    // 4. Memory leak: setTimeout/setInterval without cleanup
    if (/setTimeout|setInterval/.test(line)) {
      const context = lines.slice(Math.max(0, idx - 10), idx + 10).join('\n');
      if (/useEffect/.test(context) && !/clearTimeout|clearInterval/.test(context)) {
        critical.push({
          line: lineNum,
          type: '💧 Memory Leak',
          severity: 'critical',
          message: 'Timer without cleanup. Return cleanup function: () => clearTimeout(id)'
        });
      }
    }

    // 5. Missing return in useEffect with async
    if (/useEffect\s*\(\s*async/.test(line)) {
      critical.push({
        line: lineNum,
        type: '🐛 Hook Error',
        severity: 'critical',
        message: 'useEffect cannot be async directly. Create async function inside and call it'
      });
    }

    // 6. Modifying props
    if (/props\.\w+\s*=/.test(line)) {
      critical.push({
        line: lineNum,
        type: '⚛️ React',
        severity: 'critical',
        message: 'Props are read-only. Never mutate props directly'
      });
    }

    // 7. eval() usage
    if (/\beval\s*\(/.test(line)) {
      critical.push({
        line: lineNum,
        type: '🔒 Security',
        severity: 'critical',
        message: 'eval() is dangerous and can execute malicious code. Find alternative approach'
      });
    }

    // 8. Binding in render
    if (/(?:onClick|onChange)\s*=\s*\{[^}]*\.bind\(this/.test(line)) {
      critical.push({
        line: lineNum,
        type: '⚡ Performance',
        severity: 'critical',
        message: '.bind() in render creates new function each time. Move to constructor or use arrow functions'
      });
    }

    // 9. Conditional hook usage
    const hookPattern = /\b(useState|useEffect|useCallback|useMemo|useRef|useContext)\s*\(/;
    if (hookPattern.test(line)) {
      const prevLines = lines.slice(Math.max(0, idx - 5), idx).join('\n');
      if (/\bif\s*\(|\?\s*\(/.test(prevLines)) {
        critical.push({
          line: lineNum,
          type: '🪝 Hooks',
          severity: 'critical',
          message: 'Hooks cannot be called conditionally. Call hooks at top level of component'
        });
      }
    }

    // 10. Direct state mutation
    if (/\bstate\.\w+\s*=/.test(line) || /this\.state\.\w+\s*=/.test(line)) {
      critical.push({
        line: lineNum,
        type: '⚛️ React',
        severity: 'critical',
        message: 'Never mutate state directly. Use setState or state setter function'
      });
    }
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

    const jsFiles = files.filter(f => 
      /\.(jsx?|tsx?)$/.test(f.filename) && 
      f.status !== 'removed' &&
      !f.filename.includes('node_modules/') &&
      !f.filename.includes('dist/') &&
      !f.filename.includes('build/')
    );

    return jsFiles;
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
    console.log('✅ Posted review comment');
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

  console.log(`🔍 Reviewing React PR #${PR_NUMBER}...`);

  const files = await getPRDiff();
  
  if (files.length === 0) {
    console.log('ℹ️ No JS/TS files changed');
    return;
  }

  console.log(`📝 Found ${files.length} files to review`);

  let allCritical = [];
  let allSuggestions = [];
  let aiReviews = [];

  // Process each file
  for (const file of files.slice(0, 10)) {
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
        const patchPreview = file.patch.slice(0, 3500);
        const prompt = `File: ${file.filename}

Code changes:
\`\`\`diff
${patchPreview}
\`\`\`

Review ONLY the changed lines. Focus on React 18+ patterns, hooks best practices, and performance. Report only definite bugs.`;

        const aiReview = await callGroqAI(prompt);
        
        if (aiReview && !aiReview.includes('None') && !aiReview.includes('No issues')) {
          aiReviews.push({ file: file.filename, review: aiReview });
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`   ❌ Error processing ${file.filename}:`, error.message);
    }
  }

  // Determine gating
  const hasCritical = allCritical.length > 0;
  const totalCritical = allCritical.reduce((sum, f) => sum + f.issues.length, 0);

  // Build comment
  let comment = '## 🤖 React/JavaScript Code Review\n\n';

  if (hasCritical) {
    comment += `⛔ **Found ${totalCritical} CRITICAL issue(s) that must be fixed**\n\n`;
  }

  // Critical issues
  if (allCritical.length > 0) {
    comment += '### ⛔ Critical Issues\n\n';
    allCritical.forEach(({ file, issues }) => {
      comment += `#### 📄 ${file}\n`;
      issues.forEach(issue => {
        comment += `- **Line ${issue.line}** [${issue.type}]: ${issue.message}\n`;
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

  // Best practice suggestions (grouped by category with priority)
  if (allSuggestions.length > 0) {
    const categorizedSuggestions = {};
    
    allSuggestions.forEach(({ file, suggestions }) => {
      suggestions.forEach(suggestion => {
        if (!categorizedSuggestions[suggestion.category]) {
          categorizedSuggestions[suggestion.category] = [];
        }
        categorizedSuggestions[suggestion.category].push({
          file,
          line: suggestion.line,
          message: suggestion.message,
          priority: suggestion.priority || 'medium'
        });
      });
    });

    // Sort categories by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedCategories = Object.keys(categorizedSuggestions).sort((a, b) => {
      const aPriority = Math.min(...categorizedSuggestions[a].map(s => priorityOrder[s.priority]));
      const bPriority = Math.min(...categorizedSuggestions[b].map(s => priorityOrder[s.priority]));
      return aPriority - bPriority;
    });

    comment += '### 💡 Best Practice Suggestions\n\n';
    comment += '<details><summary>Click to view React/JavaScript best practices and performance tips</summary>\n\n';
    
    sortedCategories.forEach(category => {
      const items = categorizedSuggestions[category];
      const highPriority = items.filter(i => i.priority === 'high');
      const mediumPriority = items.filter(i => i.priority === 'medium');
      const lowPriority = items.filter(i => i.priority === 'low');
      
      comment += `#### ${category}\n\n`;
      
      if (highPriority.length > 0) {
        highPriority.forEach(({ file, line, message }) => {
          comment += `- ⚠️ **${file}:${line}** - ${message}\n`;
        });
      }
      
      if (mediumPriority.length > 0) {
        mediumPriority.forEach(({ file, line, message }) => {
          comment += `- 🔸 **${file}:${line}** - ${message}\n`;
        });
      }
      
      if (lowPriority.length > 0) {
        lowPriority.forEach(({ file, line, message }) => {
          comment += `- 💭 **${file}:${line}** - ${message}\n`;
        });
      }
      
      comment += '\n';
    });
    
    comment += '</details>\n\n';
  }

  if (allCritical.length === 0 && aiReviews.length === 0) {
    comment += '✅ **No critical issues detected**\n\n';
    comment += 'Code review passed automated checks.\n\n';
  }

  // Add legend
  comment += '---\n';
  comment += '**Priority Legend:** ⚠️ High | 🔸 Medium | 💭 Low\n\n';
  comment += '*💬 Ask questions with `@ai-reviewer [your question]` in comments*';

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