#!/usr/bin/env node
const { Octokit } = require('@octokit/rest');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const COMMENT_BODY = process.env.COMMENT_BODY || '';
const PR_NUMBER = parseInt(process.env.PR_NUMBER);
const [owner, repo] = process.env.GITHUB_REPOSITORY?.split('/') || ['', ''];

const octokit = new Octokit({ auth: GITHUB_TOKEN });

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
            content: `You are a helpful Laravel/PHP code review assistant.\nAnswer questions about Laravel best practices, security, performance, and explain code clearly.\nKeep responses concise and actionable.${context ? '\n\nContext:\n' + context : ''}`
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.4,
        max_tokens: 1000,
      }),
    });

    const data = await response.json();
    return data.choices[0]?.message?.content || '❌ Unable to get AI response';
  } catch (error) {
    console.error('Error calling AI:', error);
    return '❌ Error communicating with AI';
  }
}

function extractQuestion(comment) {
  return comment.replace(/@ai-reviewer/gi, '').trim();
}

async function getPRContext() {
  try {
    const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: PR_NUMBER });
    const { data: files } = await octokit.pulls.listFiles({ owner, repo, pull_number: PR_NUMBER });
    const phpFiles = files.filter(f => /\.php$/.test(f.filename)).slice(0, 3);

    let context = `PR: ${pr.title}\n`;
    if (pr.body) context += `Description: ${pr.body.slice(0, 200)}\n`;
    context += `\nChanged files: ${phpFiles.map(f => f.filename).join(', ')}`;
    return context;
  } catch (error) {
    console.error('Error getting PR context:', error);
    return '';
  }
}

async function postReply(body) {
  try {
    await octokit.issues.createComment({ owner, repo, issue_number: PR_NUMBER, body });
    console.log('✅ Posted reply');
  } catch (error) {
    console.error('Error posting reply:', error);
  }
}

async function handleComment() {
  console.log(`💬 Handling Laravel comment on PR #${PR_NUMBER}`);
  const question = extractQuestion(COMMENT_BODY);
  if (!question) {
    await postReply('👋 Mention `@ai-reviewer` followed by your question!\n\nExamples:\n- @ai-reviewer explain this eloquent query\n- @ai-reviewer how can I prevent SQL injection here?\n- @ai-reviewer is this the best approach for validation?');
    return;
  }
  const context = await getPRContext();
  const answer = await askAI(question, context);
  const reply = `**@ai-reviewer (Laravel):** ${answer}\n\n---\n*Ask me anything by mentioning @ai-reviewer*`;
  await postReply(reply);
}

handleComment().catch(err => { console.error(err); process.exitCode = 1; });