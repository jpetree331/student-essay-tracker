/**
 * Anthropic (Claude) provider. Model per task kind, overridable via env.
 */
const name = 'anthropic';
const keyEnv = 'ANTHROPIC_API_KEY';

const TASKS = {
  tag: {
    model: () => process.env.ANTHROPIC_TAG_MODEL || 'claude-haiku-4-5-20251001',
    maxTokens: 2048,
  },
  compare: {
    model: () => process.env.ANTHROPIC_COMPARE_MODEL || 'claude-sonnet-4-6',
    maxTokens: 8192,
  },
};

async function complete({ system, user, kind }) {
  const task = TASKS[kind];
  if (!task) throw new Error(`Unknown AI task kind: ${kind}`);

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: String(process.env[keyEnv]).trim() });
  const model = task.model();

  const message = await client.messages.create({
    model,
    max_tokens: task.maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = (message.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  return { text, modelUsed: model, provider: name, usage: message.usage ?? null };
}

module.exports = { name, keyEnv, complete };
