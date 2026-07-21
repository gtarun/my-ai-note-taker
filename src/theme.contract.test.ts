import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Guards against colour that cannot follow the theme.
 *
 * A hardcoded hex is invisible until someone switches appearance — a pale mint
 * "synced" badge and a pink danger panel stayed bright on a dark screen, and
 * nothing in the type system or the rest of the suite noticed. This is the only
 * cheap way to catch the next one.
 */

const ROOTS = ['src', 'app'];
const ALLOWED = new Set([
  // The token definitions themselves, obviously.
  'src/theme.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

function sourceFiles(): string[] {
  return ROOTS.flatMap((root) => walk(root)).filter((path) => !ALLOWED.has(path));
}

describe('theme contract', () => {
  it('has no hardcoded hex colours outside the token file', () => {
    const offenders: string[] = [];

    for (const path of sourceFiles()) {
      const contents = readFileSync(path, 'utf8');

      contents.split('\n').forEach((line, index) => {
        // Skip comments — hexes are often quoted in explanatory prose.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
          return;
        }

        if (/['"]#[0-9a-fA-F]{3,8}['"]/.test(line)) {
          offenders.push(`${path}:${index + 1}  ${trimmed}`);
        }
      });
    }

    expect(offenders, `Use a palette token so the colour follows the theme:\n${offenders.join('\n')}`)
      .toEqual([]);
  });

  it('has no raw rgba colours outside the token file', () => {
    const offenders: string[] = [];

    for (const path of sourceFiles()) {
      const contents = readFileSync(path, 'utf8');

      contents.split('\n').forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
          return;
        }

        if (/rgba?\(\s*\d/.test(line)) {
          offenders.push(`${path}:${index + 1}  ${trimmed}`);
        }
      });
    }

    expect(offenders, `Use a palette token so the colour follows the theme:\n${offenders.join('\n')}`)
      .toEqual([]);
  });
});
