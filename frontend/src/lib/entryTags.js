/** True if API joined a writing_tags row (any column from that row is non-null). */
export function entryHasWritingTagsRow(entry) {
  return entry?.claim_present !== null && entry?.claim_present !== undefined;
}
