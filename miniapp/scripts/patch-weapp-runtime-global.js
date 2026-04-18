const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const runtimePath = path.join(projectRoot, 'dist', 'weapp', 'runtime.js');
const legacySnippet = [
  "/******/ \t\t__webpack_require__.g = (function() {",
  "/******/ \t\t\tif (typeof globalThis === 'object') return globalThis;",
  "/******/ \t\t\ttry {",
  "/******/ \t\t\t\treturn this || new Function('return this')();",
  "/******/ \t\t\t} catch (e) {",
  "/******/ \t\t\t\tif (typeof window === 'object') return window;",
  "/******/ \t\t\t}",
  "/******/ \t\t})();",
].join('\n');

const patchedSnippet = [
  "/******/ \t\t__webpack_require__.g = (function() {",
  "/******/ \t\t\tif (typeof globalThis === 'object' && globalThis) return globalThis;",
  "/******/ \t\t\tif (typeof wx === 'object' && wx) return wx;",
  "/******/ \t\t\tif (typeof self === 'object' && self) return self;",
  "/******/ \t\t\tif (typeof window === 'object' && window) return window;",
  "/******/ \t\t\treturn {};",
  "/******/ \t\t})();",
].join('\n');

function patchWeappRuntimeGlobal() {
  if (!fs.existsSync(runtimePath)) {
    return {
      skipped: true,
      patched: false,
      reason: 'runtime.js not found',
    };
  }

  const source = fs.readFileSync(runtimePath, 'utf8');

  if (source.includes(patchedSnippet)) {
    return {
      skipped: false,
      patched: false,
      reason: 'already patched',
    };
  }

  if (!source.includes(legacySnippet)) {
    return {
      skipped: false,
      patched: false,
      reason: 'legacy global snippet not found',
    };
  }

  fs.writeFileSync(runtimePath, source.replace(legacySnippet, patchedSnippet), 'utf8');

  return {
    skipped: false,
    patched: true,
    reason: 'patched',
  };
}

function main() {
  const result = patchWeappRuntimeGlobal();

  if (result.skipped) {
    console.warn(`[patch-weapp-runtime-global] skipped: ${result.reason}.`);
    return;
  }

  if (!result.patched) {
    console.log(`[patch-weapp-runtime-global] no change: ${result.reason}.`);
    return;
  }

  console.log('[patch-weapp-runtime-global] patched runtime global detection for WeChat real device.');
}

module.exports = {
  patchWeappRuntimeGlobal,
};

if (require.main === module) {
  main();
}
