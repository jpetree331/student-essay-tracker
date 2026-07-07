/**
 * OpenAI provider. Model per task kind, overridable via env.
 *
 * Token caps are higher than Anthropic's because OpenAI reasoning models
 * (gpt-5 family) spend part of max_completion_tokens on internal reasoning.
 */
const name = 'openai';
const keyEnv = 'OPENAI_API_KEY';

const TASKS = {
  tag: {
    model: () => process.env.OPENAI_TAG_MODEL || 'gpt-5-mini',
    maxTokens: 8192,
  },
  compare: {
    model: () => process.env.OPENAI_COMPARE_MODEL || 'gpt-5',
    maxTokens: 16384,
  },
};

async function complete({ system, user, kind }) {
  const task = TASKS[kind];
  if (!task) throw new Error(`Unknown AI task kind: ${kind}`);

  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: String(process.env[keyEnv]).trim() });
  const model = task.model();

  const completion = await client.chat.completions.create({
    model,
    max_completion_tokens: task.maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const text = (completion.choices?.[0]?.message?.content || '').trim();
  return { text, modelUsed: model, provider: name, usage: completion.usage ?? null };
}

module.exports = { name, keyEnv, complete };
