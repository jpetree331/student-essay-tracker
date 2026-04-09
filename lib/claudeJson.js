/**
 * Shared parsing for Claude message text → JSON (fences + embedded object).
 */
function parseModelJson(text) {
  if (text == null || typeof text !== 'string') {
    throw new Error('Empty model response');
  }
  let s = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```\s*$/im.exec(s);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new Error('Model response did not contain valid JSON');
    }
    return JSON.parse(s.slice(start, end + 1));
  }
}

module.exports = { parseModelJson };
