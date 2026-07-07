/**
 * AI provider selection (Anthropic or OpenAI).
 *
 * The active provider is chosen by AI_PROVIDER=anthropic|openai when set,
 * otherwise by whichever API key is configured (Anthropic wins if both are
 * set). Throws a 503-tagged error when nothing is configured so routes keep
 * the existing "AI is optional" behavior.
 */
const anthropicProvider = require('./anthropicProvider');
const openaiProvider = require('./openaiProvider');

const PROVIDERS = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
};

function hasKey(envName) {
  const v = process.env[envName];
  return Boolean(v && String(v).trim());
}

function unavailable(message) {
  const err = new Error(message);
  err.statusCode = 503;
  return err;
}

function resolveProvider() {
  const override = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (override) {
    const provider = PROVIDERS[override];
    if (!provider) {
      throw unavailable(`Unknown AI_PROVIDER "${override}" (expected "anthropic" or "openai")`);
    }
    if (!hasKey(provider.keyEnv)) {
      throw unavailable(`AI_PROVIDER is "${override}" but ${provider.keyEnv} is not configured`);
    }
    return provider;
  }
  if (hasKey(anthropicProvider.keyEnv)) return anthropicProvider;
  if (hasKey(openaiProvider.keyEnv)) return openaiProvider;
  throw unavailable('No AI provider configured — set ANTHROPIC_API_KEY or OPENAI_API_KEY');
}

module.exports = { resolveProvider };
