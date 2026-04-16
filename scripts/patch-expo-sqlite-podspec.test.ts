import { describe, expect, test } from 'vitest';

const {
  MARKER,
  SQLITE_C_MODULE_MAP,
  SQLITE_IMPORT_MARKER,
  SWIFT_MODULEMAP_MARKER,
  patchExpoSQLitePodspecText,
  patchSQLiteModuleText,
} = require('../scripts/patch-expo-sqlite-podspec.cjs');

describe('patchExpoSQLitePodspecText', () => {
  test('adds sqlite3.h as a public header when missing', () => {
    const source = [
      "Pod::Spec.new do |s|",
      '  s.name = "ExpoSQLite"',
      `  swift_flags = sqlite_cflags.split(' ').map { |flag| "-Xcc #{flag}" }.join(' ')`,
      '  s.source_files = "**/*.{c,h,m,swift}"',
      'end',
      '',
    ].join('\n');

    const patched = patchExpoSQLitePodspecText(source);

    expect(patched).toContain(MARKER);
    expect(patched).toContain(SWIFT_MODULEMAP_MARKER);
    expect(patched).toContain(`${'  s.source_files = "**/*.{c,h,m,swift}"'}\n  ${MARKER}`);
  });

  test('is idempotent when the patch already exists', () => {
    const source = [
      "Pod::Spec.new do |s|",
      '  s.name = "ExpoSQLite"',
      `  swift_flags = sqlite_cflags.split(' ').map { |flag| "-Xcc #{flag}" }.join(' ')`,
      `  ${SWIFT_MODULEMAP_MARKER}`,
      '  s.source_files = "**/*.{c,h,m,swift}"',
      `  ${MARKER}`,
      'end',
      '',
    ].join('\n');

    expect(patchExpoSQLitePodspecText(source)).toBe(source);
  });
});

describe('patchSQLiteModuleText', () => {
  test('adds the dedicated sqlite c module import when missing', () => {
    const source = ['import ExpoModulesCore', '', 'private typealias SQLiteColumnNames = [String]'].join(
      '\n'
    );

    const patched = patchSQLiteModuleText(source);

    expect(patched).toContain(SQLITE_IMPORT_MARKER);
    expect(patched).toContain(`import ExpoModulesCore\n${SQLITE_IMPORT_MARKER}`);
  });

  test('exports the expected module map contents', () => {
    expect(SQLITE_C_MODULE_MAP).toContain('module ExpoSQLiteC');
    expect(SQLITE_C_MODULE_MAP).toContain('header "sqlite3.h"');
  });
});
