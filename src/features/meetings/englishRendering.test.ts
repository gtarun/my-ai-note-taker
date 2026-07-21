import { describe, expect, it } from 'vitest';

import {
  buildTranscriptTabs,
  shouldOfferEnglishTab,
  splitTranscriptIntoChunks,
} from './englishRendering';

describe('splitTranscriptIntoChunks', () => {
  it('leaves a short transcript in one piece', () => {
    expect(splitTranscriptIntoChunks('A short meeting.', 6000)).toEqual(['A short meeting.']);
  });

  it('returns nothing for an empty transcript', () => {
    expect(splitTranscriptIntoChunks('   ')).toEqual([]);
  });

  it('breaks on sentence ends rather than mid-word', () => {
    const transcript = 'One sentence here. Two sentences here. Three sentences here.';
    const chunks = splitTranscriptIntoChunks(transcript, 25);

    // Each chunk has to be a whole thought: chunks are translated independently,
    // so a fragment gets rendered as if it were a complete sentence.
    for (const chunk of chunks) {
      expect(chunk).toMatch(/\.$/);
    }
    expect(chunks.join(' ')).toBe(transcript);
  });

  it('breaks on the Devanagari danda, not just ASCII punctuation', () => {
    // Hindi and Punjabi end sentences with U+0964. An ASCII-only rule falls
    // through to the space case and cuts these transcripts mid-clause.
    const transcript = 'वेंडर कॉन्ट्रैक्ट देखना है। ड्राफ्ट आज रात भेज दूंगी। ठीक है।';
    const chunks = splitTranscriptIntoChunks(transcript, 30);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.endsWith('।')).toBe(true);
    }
  });

  it('loses no content when it splits', () => {
    const transcript = Array.from({ length: 60 }, (_, i) => `Sentence number ${i}.`).join(' ');
    const chunks = splitTranscriptIntoChunks(transcript, 120);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toBe(transcript);
  });

  it('still makes progress on text with no natural break at all', () => {
    // A wall of characters with no space would loop forever if the fallback
    // failed to advance.
    const transcript = 'x'.repeat(500);
    const chunks = splitTranscriptIntoChunks(transcript, 100);

    expect(chunks.length).toBe(5);
    expect(chunks.join('')).toBe(transcript);
  });
});

describe('shouldOfferEnglishTab', () => {
  it('offers both when the meeting was not held in English', () => {
    expect(
      shouldOfferEnglishTab('वेंडर कॉन्ट्रैक्ट देखना है।', 'We need to review the vendor contract.')
    ).toBe(true);
  });

  it('offers both when the clean pass actually changed an English transcript', () => {
    expect(
      shouldOfferEnglishTab('so um we need to uh review the the contract', 'We need to review the contract.')
    ).toBe(true);
  });

  it('collapses to one tab when the rendering came back unchanged', () => {
    // Two tabs showing identical text is worse than no tab bar.
    expect(
      shouldOfferEnglishTab('We need to review the contract.', 'we need to review the contract.  ')
    ).toBe(false);
  });

  it('collapses to one tab when there is no English rendering yet', () => {
    expect(shouldOfferEnglishTab('Some words.', null)).toBe(false);
    expect(shouldOfferEnglishTab('Some words.', '')).toBe(false);
  });
});

describe('buildTranscriptTabs', () => {
  it('leads with English so the readable version is the default', () => {
    const tabs = buildTranscriptTabs('वेंडर कॉन्ट्रैक्ट देखना है।', 'We need to review the vendor contract.');

    expect(tabs.map((tab) => tab.id)).toEqual(['english', 'verbatim']);
    expect(tabs[0].label).toBe('Clean English');
    expect(tabs[1].label).toBe('Exact words');
  });

  it('shows a single tab when only the verbatim text exists', () => {
    const tabs = buildTranscriptTabs('Just the raw words.', null);

    expect(tabs).toEqual([{ id: 'verbatim', label: 'Exact words', text: 'Just the raw words.' }]);
  });

  it('falls back to the English text when the verbatim text is missing', () => {
    // Should not happen, but rendering an empty section because one column is
    // null while the other holds the whole meeting would be the worse failure.
    const tabs = buildTranscriptTabs(null, 'We reviewed the contract.');

    expect(tabs).toHaveLength(1);
    expect(tabs[0].text).toBe('We reviewed the contract.');
  });

  it('returns nothing when the meeting has neither', () => {
    expect(buildTranscriptTabs(null, null)).toEqual([]);
  });
});
