import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../db', () => ({ getDatabase: vi.fn() }));

import { checkUpstreamMatchesCatalog } from './localModels';

/*
 * These guard the replacement for a checksum pass that could not ship.
 *
 * Verifying a 488 MB model by hashing it in JavaScript measured 9.2 MB/s under
 * Node's JIT and is slower again under Hermes, so "Verifying" sat on screen for
 * minutes with the JS thread blocked — indistinguishable from a hang, and the
 * only two downloadable transcription models both carried a digest, so every
 * successful download hit it. The digest is now compared against what the host
 * publishes, before the bytes are fetched rather than after.
 */
describe('checkUpstreamMatchesCatalog', () => {
  const whisperSmall = {
    sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
    sizeBytes: 487601967,
  };

  it('accepts an artifact the host and catalog agree on', () => {
    expect(
      checkUpstreamMatchesCatalog(whisperSmall, {
        sha256: whisperSmall.sha256,
        sizeBytes: whisperSmall.sizeBytes,
      })
    ).toEqual({ ok: true });
  });

  it('refuses a digest that has drifted from the catalog', () => {
    const result = checkUpstreamMatchesCatalog(whisperSmall, {
      sha256: 'a'.repeat(64),
      sizeBytes: whisperSmall.sizeBytes,
    });

    expect(result.ok).toBe(false);
  });

  it('refuses a size that disagrees even when the digest is absent from one side', () => {
    const result = checkUpstreamMatchesCatalog(whisperSmall, {
      sha256: whisperSmall.sha256,
      sizeBytes: 511705088, // The wrong 488 MB — MB confused for MiB.
    });

    expect(result.ok).toBe(false);
  });

  it('treats an unreachable host as unknown rather than as a mismatch', () => {
    // A flaky network or a non-Hugging-Face mirror must not block a download
    // that is otherwise fine; the on-disk size check still runs afterwards.
    expect(checkUpstreamMatchesCatalog(whisperSmall, null)).toEqual({ ok: true });
  });

  it('skips the comparison for catalog entries that carry no digest', () => {
    expect(
      checkUpstreamMatchesCatalog(
        { sha256: '', sizeBytes: 986049728 },
        { sha256: 'b'.repeat(64), sizeBytes: 1 }
      )
    ).toEqual({ ok: true });
  });

  it('tolerates catalog digests stored with stray case or whitespace', () => {
    expect(
      checkUpstreamMatchesCatalog(
        { sha256: `  ${whisperSmall.sha256.toUpperCase()}  `, sizeBytes: whisperSmall.sizeBytes },
        { sha256: whisperSmall.sha256, sizeBytes: whisperSmall.sizeBytes }
      )
    ).toEqual({ ok: true });
  });
});
