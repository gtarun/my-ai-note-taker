/**
 * Splitting a transcript for translation, and deciding whether to bother.
 *
 * Kept away from the network code so the two decisions that actually go wrong —
 * where to cut a long transcript, and when an English rendering is worth paying
 * for — can be tested without mocking a provider.
 */

/**
 * Roughly 6k characters per request. Well inside every provider's limits once
 * the response is accounted for: the output of a translation is about as long
 * as its input, so a chunk has to leave room for itself twice over.
 */
export const TRANSCRIPT_CHUNK_CHARS = 6000;

/**
 * Cut a transcript into chunks that end on a sentence wherever possible.
 *
 * Cutting mid-sentence is not a cosmetic problem: each chunk is translated
 * without sight of the others, so a fragment gets rendered as though it were a
 * whole thought and the seam shows up as a broken sentence in the result.
 */
export function splitTranscriptIntoChunks(
  transcript: string,
  maxChars: number = TRANSCRIPT_CHUNK_CHARS
): string[] {
  const trimmed = transcript.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.length <= maxChars) {
    return [trimmed];
  }

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);

    // Prefer a paragraph break, then a sentence end, then a space. Devanagari
    // and Gurmukhi end sentences with U+0964, which no ASCII-only rule catches.
    const breakPoint =
      lastIndexOfAny(window, ['\n\n']) ??
      lastIndexOfAny(window, ['। ', '।\n', '. ', '? ', '! ', '.\n', '?\n', '!\n']) ??
      lastIndexOfAny(window, [' ']) ??
      maxChars;

    chunks.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks.filter(Boolean);
}

/**
 * Finds the end of the latest occurrence of any separator, or null.
 *
 * Returns the index *after* the separator so the delimiter stays with the chunk
 * it terminates — a chunk that starts with a stray full stop reads as an error.
 */
function lastIndexOfAny(source: string, separators: string[]): number | null {
  let best: number | null = null;

  for (const separator of separators) {
    const index = source.lastIndexOf(separator);

    if (index > 0) {
      const end = index + separator.length;
      best = best === null ? end : Math.max(best, end);
    }
  }

  return best;
}

/**
 * Whether the two renderings differ enough to be worth two tabs.
 *
 * An English meeting still benefits from the clean pass — fillers and false
 * starts go — but if the model returned something all but identical, a tab bar
 * offering the same text twice is worse than no tab bar at all.
 */
export function shouldOfferEnglishTab(original: string | null, english: string | null): boolean {
  const left = (original ?? '').trim();
  const right = (english ?? '').trim();

  if (!left || !right) {
    return false;
  }

  return normalizeForComparison(left) !== normalizeForComparison(right);
}

function normalizeForComparison(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export type TranscriptTabId = 'english' | 'verbatim';

export type TranscriptTab = {
  id: TranscriptTabId;
  label: string;
  text: string;
};

/**
 * The tabs to show for a transcript, in order.
 *
 * When there is no English rendering the verbatim text is simply the section's
 * content — the caller renders a single body rather than a one-tab tab bar.
 */
export function buildTranscriptTabs(
  verbatim: string | null,
  english: string | null
): TranscriptTab[] {
  const verbatimText = (verbatim ?? '').trim();
  const englishText = (english ?? '').trim();

  if (!verbatimText && !englishText) {
    return [];
  }

  if (!shouldOfferEnglishTab(verbatimText, englishText)) {
    return [{ id: 'verbatim', label: 'Exact words', text: verbatimText || englishText }];
  }

  // English leads because it is the one most people can read, and it is the
  // interpretation — putting it first makes the verbatim record the thing you
  // deliberately check rather than the thing you have to get past.
  return [
    { id: 'english', label: 'Clean English', text: englishText },
    { id: 'verbatim', label: 'Exact words', text: verbatimText },
  ];
}
