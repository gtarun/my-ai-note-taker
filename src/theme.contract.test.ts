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

  it('never imports the static palette into a component file', () => {
    /*
     * `theme.ts` exports a `palette` bound to the light scheme, for the tokens
     * that genuinely cannot be hooks — the Expo Router tab bar config, say.
     * Inside a component it is a trap: it type-checks, renders, and quietly
     * paints light colours on a dark screen.
     *
     * That is not hypothetical. Every component in the app carried this import
     * while shadowing it with `useTheme()`, so it read as harmless — until
     * three components used it in JSX without the shadow and shipped a
     * near-white skeleton bar on a near-black page, a light-viridian avatar
     * icon on a dark card, and a record button ignoring its dark fill. Deleting
     * the imports turned all three from invisible into compile errors.
     */
    const offenders: string[] = [];

    for (const path of sourceFiles()) {
      if (!/\.tsx$/.test(path)) {
        continue;
      }

      const contents = readFileSync(path, 'utf8');
      const themeImport = contents.match(/import\s*\{([^}]*)\}\s*from\s*'[^']*theme'/);

      if (themeImport?.[1]?.split(',').some((name) => name.trim() === 'palette')) {
        offenders.push(`${path}  imports the static light palette`);
      }
    }

    expect(
      offenders,
      `Call useTheme() or useThemedStyles() instead — the static palette is always light:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
