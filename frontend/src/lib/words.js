/** Match server lib/words.js: trimmed split on whitespace. */
export function wordCount(text) {
  if (text == null || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
