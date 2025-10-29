#!/usr/bin/env node
const { Octokit } = require('@octokit/rest');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const COMMENT_BODY = process.env.COMMENT_BODY || '';
const PR_NUMBER = parseInt(process.env.PR_NUMBER);
const [owner, repo] = process.env.GITHUB_REPOSITORY?.split('/') || ['', ''];

const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Call Groq AI for interactive responses with React expertise
 */
async function askAI(question, context = '') {
  if (!GROQ_API_KEY) {
    return '⚠️ GROQ_API_KEY not configured. Add it to GitHub Secrets to enable AI responses.';
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
            content: `You are an expert React/JavaScript code reviewer (2024-2025 standards).

EXPERTISE:
- React 18+ features: Suspense, Transitions, Server Components, Concurrent Rendering
- Modern hooks: useState, useEffect, useCallback, useMemo, useTransition, useDeferredValue
- Performance optimization: memoization, lazy loading, code splitting
- TypeScript with React
- Testing: Jest, React Testing Library, Vitest
- State management: Context API, Zustand, Redux Toolkit
- Build tools: Vite, Next.js, Remix

RESPONSE STYLE:
- Be concise and actionable
- Provide code examples when helpful
- Focus on modern best practices (avoid class components unless maintaining legacy code)
- Explain WHY, not just WHAT
- Reference official React documentation when relevant

AVOID:
- Outdated patterns (componentDidMount, etc.)
- Overly complex solutions
- Subjective styling opinions
${context ? '\n\nCONTEXT:\n' + context : ''}`
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.5,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error(`Groq API error: ${response.status}`);
      return '❌ Error communicating with AI service';
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '❌ Unable to get AI response';
  } catch (error) {
    console.error('Error calling AI:', error);
    return '❌ Error communicating with AI';
  }
}

/**
 * Extract the question from comment
 */
function extractQuestion(comment) {
  return comment
    .replace(/@ai-reviewer/gi, '')
    .trim();
}

/**
 * Get PR context for better responses
 */
async function getPRContext() {
  try {
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: PR_NUMBER,
    });

    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: PR_NUMBER,
    });

    const jsFiles = files
      .filter(f => /\.(jsx?|tsx?)$/.test(f.filename))
      .slice(0, 5);

    let context = `PR: ${pr.title}\n`;
    
    if (pr.body) {
      context += `Description: ${pr.body.slice(0, 300)}\n`;
    }
    
    context += `\nChanged files (${files.length} total):\n`;
    jsFiles.forEach(f => {
      context += `- ${f.filename} (${f.additions}+ ${f.deletions}-)\n`;
    });

    // Get a sample of the code if available
    if (jsFiles.length > 0 && jsFiles[0].patch) {
      context += `\n\nCode sample from ${jsFiles[0].filename}:\n\`\`\`\n${jsFiles[0].patch.slice(0, 800)}\n\`\`\``;
    }

    return context;
  } catch (error) {
    console.error('Error getting PR context:', error);
    return '';
  }
}

/**
 * Post reply
 */
async function postReply(body) {
  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: PR_NUMBER,
      body,
    });
    console.log('✅ Posted reply');
  } catch (error) {
    console.error('Error posting reply:', error);
  }
}

/**
 * Detect if question is about specific file
 */
function detectFileName(question) {
  const filePattern = /\b[\w-]+\.(jsx?|tsx?)\b/;
  const match = question.match(filePattern);
  return match ? match[0] : null;
}

/**
 * Main handler
 */
async function handleComment() {
  console.log(`💬 Handling comment on PR #${PR_NUMBER}`);
  
  const question = extractQuestion(COMMENT_BODY);
  
  if (!question) {
    await postReply(`👋 Hi! I'm the AI code reviewer. Ask me anything about this React/JavaScript code!

**Examples:**
- \`@ai-reviewer explain this hook pattern\`
- \`@ai-reviewer how can I improve performance?\`
- \`@ai-reviewer is this the best way to handle state?\`
- \`@ai-reviewer what's wrong with this useEffect?\`
- \`@ai-reviewer suggest alternatives for this component\`

I'm familiar with React 18+, TypeScript, modern hooks, and performance optimization.`);
    return;
  }

  console.log(`❓ Question: ${question}`);

  // Check if question mentions a specific file
  const mentionedFile = detectFileName(question);
  let fileContent = null;
  
  if (mentionedFile) {
    console.log(`📄 Looking for file: ${mentionedFile}`);
    try {
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: mentionedFile,
        ref: process.env.GITHUB_SHA || 'HEAD',
      });
      const content = Buffer.from(fileData.content, 'base64').toString('utf8');
      fileContent = content.slice(0, 2000);
    } catch {}
  }

  // Get context
  const context = await getPRContext();
  
  // Enhance context with file content if available
  const fullContext = fileContent 
    ? `${context}\n\nFile content (${mentionedFile}):\n\`\`\`\n${fileContent}\n\`\`\``
    : context;

  // Ask AI
  const answer = await askAI(question, fullContext);

  // Format and post reply
  const reply = `### 🤖 AI Reviewer Response (React)

${answer}

---
*Have more questions? Just mention \`@ai-reviewer\` followed by your question!*`;
  
  await postReply(reply);
}

handleComment().catch(err => {
  console.error('Error in comment handler:', err);
  process.exitCode = 1;
});