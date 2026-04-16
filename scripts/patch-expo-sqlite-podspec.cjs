const fs = require('fs');
const path = require('path');

const MARKER = `s.public_header_files = ['sqlite3.h']`;
const SWIFT_MODULEMAP_MARKER =
  "swift_flags += ' -Xcc -fmodule-map-file=${PODS_TARGET_SRCROOT}/ExpoSQLiteC.modulemap'";
const SQLITE_IMPORT_MARKER = '@_implementationOnly import ExpoSQLiteC';
const SQLITE_C_MODULE_MAP = `module ExpoSQLiteC {\n  header "sqlite3.h"\n  export *\n}\n`;

function patchExpoSQLitePodspecText(source) {
  let patched = source;

  if (!patched.includes(MARKER)) {
    const needle = `  s.source_files = "**/*.{c,h,m,swift}"`;
    if (!patched.includes(needle)) {
      throw new Error('Could not find ExpoSQLite source_files declaration to patch');
    }

    patched = patched.replace(needle, `${needle}\n  ${MARKER}`);
  }

  if (!patched.includes(SWIFT_MODULEMAP_MARKER)) {
    const swiftFlagsNeedle =
      `  swift_flags = sqlite_cflags.split(' ').map { |flag| "-Xcc #{flag}" }.join(' ')`;
    if (!patched.includes(swiftFlagsNeedle)) {
      throw new Error('Could not find ExpoSQLite swift_flags declaration to patch');
    }

    patched = patched.replace(swiftFlagsNeedle, `${swiftFlagsNeedle}\n  ${SWIFT_MODULEMAP_MARKER}`);
  }

  return patched;
}

function patchSQLiteModuleText(source) {
  let patched = source.replace(/\nimport ExpoSQLiteC\b/g, '');

  if (patched.includes(SQLITE_IMPORT_MARKER)) {
    return patched;
  }

  const needle = `import ExpoModulesCore`;
  if (!patched.includes(needle)) {
    throw new Error('Could not find ExpoModulesCore import in SQLiteModule.swift');
  }

  return patched.replace(needle, `${needle}\n${SQLITE_IMPORT_MARKER}`);
}

function patchExpoSQLitePodspecFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const patched = patchExpoSQLitePodspecText(source);

  if (patched !== source) {
    fs.writeFileSync(filePath, patched);
  }
}

function patchSQLiteModuleFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const patched = patchSQLiteModuleText(source);

  if (patched !== source) {
    fs.writeFileSync(filePath, patched);
  }
}

function ensureExpoSQLiteCModuleMap(filePath) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === SQLITE_C_MODULE_MAP) {
    return;
  }

  fs.writeFileSync(filePath, SQLITE_C_MODULE_MAP);
}

function getDefaultPodspecPath() {
  return path.join(process.cwd(), 'node_modules', 'expo-sqlite', 'ios', 'ExpoSQLite.podspec');
}

function getDefaultSQLiteModulePath() {
  return path.join(process.cwd(), 'node_modules', 'expo-sqlite', 'ios', 'SQLiteModule.swift');
}

function getDefaultSQLiteCModuleMapPath() {
  return path.join(process.cwd(), 'node_modules', 'expo-sqlite', 'ios', 'ExpoSQLiteC.modulemap');
}

if (require.main === module) {
  patchExpoSQLitePodspecFile(getDefaultPodspecPath());
  patchSQLiteModuleFile(getDefaultSQLiteModulePath());
  ensureExpoSQLiteCModuleMap(getDefaultSQLiteCModuleMapPath());
}

module.exports = {
  MARKER,
  SQLITE_C_MODULE_MAP,
  SQLITE_IMPORT_MARKER,
  SWIFT_MODULEMAP_MARKER,
  patchExpoSQLitePodspecFile,
  patchExpoSQLitePodspecText,
  patchSQLiteModuleFile,
  patchSQLiteModuleText,
  ensureExpoSQLiteCModuleMap,
};
