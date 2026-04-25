const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const taroPath = path.join(projectRoot, 'dist', 'weapp', 'taro.js');

const firstChildNeedle = '      return this.childNodes[0] || null;';
const firstChildPatch = [
  "      var descriptor = Object.getOwnPropertyDescriptor(this, 'childNodes');",
  '      if (!descriptor || !Array.isArray(descriptor.value)) {',
  '        return null;',
  '      }',
  '      return descriptor.value[0] || null;',
].join('\n');

const lastChildNeedle = [
  '      var childNodes = this.childNodes;',
  '      return childNodes[childNodes.length - 1] || null;',
].join('\n');
const lastChildPatch = [
  "      var descriptor = Object.getOwnPropertyDescriptor(this, 'childNodes');",
  '      if (!descriptor || !Array.isArray(descriptor.value)) {',
  '        return null;',
  '      }',
  '      var childNodes = descriptor.value;',
  '      return childNodes[childNodes.length - 1] || null;',
].join('\n');

function patchWeappTaroNodeGetters() {
  if (!fs.existsSync(taroPath)) {
    return {
      skipped: true,
      patched: false,
      reason: 'taro.js not found',
    };
  }

  let source = fs.readFileSync(taroPath, 'utf8');
  let changed = false;

  if (source.includes(firstChildNeedle)) {
    source = source.replace(firstChildNeedle, firstChildPatch);
    changed = true;
  }

  if (source.includes(lastChildNeedle)) {
    source = source.replace(lastChildNeedle, lastChildPatch);
    changed = true;
  }

  if (!changed) {
    return {
      skipped: false,
      patched: false,
      reason: 'already patched or target snippet not found',
    };
  }

  fs.writeFileSync(taroPath, source, 'utf8');

  return {
    skipped: false,
    patched: true,
    reason: 'patched',
  };
}

function main() {
  const result = patchWeappTaroNodeGetters();
  if (result.skipped) {
    console.warn(`[patch-weapp-taro-node-getters] skipped: ${result.reason}.`);
    return;
  }
  if (!result.patched) {
    console.log(`[patch-weapp-taro-node-getters] no change: ${result.reason}.`);
    return;
  }
  console.log('[patch-weapp-taro-node-getters] patched firstChild/lastChild getters for real-device stability.');
}

module.exports = {
  patchWeappTaroNodeGetters,
};

if (require.main === module) {
  main();
}
