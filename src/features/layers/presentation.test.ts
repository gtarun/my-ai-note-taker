import { describe, expect, test } from 'vitest';

import { getLayerEditorSheetHeightRatio } from './presentation';

describe('layer presentation', () => {
  test('uses a taller editor sheet when nested overlays are open', () => {
    expect(getLayerEditorSheetHeightRatio(false)).toBe(0.9);
    expect(getLayerEditorSheetHeightRatio(true)).toBe(0.96);
  });
});
