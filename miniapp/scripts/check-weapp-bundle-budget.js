const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist', 'weapp');
const appJsonPath = path.join(distRoot, 'app.json');

const MAIN_PACKAGE_BUDGET_BYTES = 1.5 * 1024 * 1024;
const SUBPACKAGE_BUDGET_BYTES = 1.5 * 1024 * 1024;
const SINGLE_ASSET_BUDGET_BYTES = 600 * 1024;

function walkFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const files = [];
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, item.name);
    if (item.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (item.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function relativeForLog(filePath) {
  return path.relative(distRoot, filePath).replace(/\\/g, '/');
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function packageSize(files) {
  return files.reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
}

function isInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function readSubPackageRoots() {
  if (!fs.existsSync(appJsonPath)) {
    throw new Error(`Missing app.json: ${appJsonPath}`);
  }

  const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const subPackages = appConfig.subPackages || appConfig.subpackages || [];
  return subPackages
    .map((item) => String(item.root || '').replace(/\/$/, ''))
    .filter(Boolean)
    .map((root) => path.join(distRoot, root));
}

function main() {
  const subPackageRoots = readSubPackageRoots();
  const allFiles = walkFiles(distRoot);
  const failures = [];

  const mainFiles = allFiles.filter((filePath) => !subPackageRoots.some((root) => isInside(filePath, root) || filePath === root));
  const mainSize = packageSize(mainFiles);
  if (mainSize > MAIN_PACKAGE_BUDGET_BYTES) {
    failures.push(`main package ${formatBytes(mainSize)} exceeds ${formatBytes(MAIN_PACKAGE_BUDGET_BYTES)}`);
  }

  const subPackageSummaries = subPackageRoots.map((root) => {
    const files = walkFiles(root);
    const size = packageSize(files);
    if (size > SUBPACKAGE_BUDGET_BYTES) {
      failures.push(`${relativeForLog(root)} ${formatBytes(size)} exceeds ${formatBytes(SUBPACKAGE_BUDGET_BYTES)}`);
    }
    return `${relativeForLog(root)} ${formatBytes(size)}`;
  });

  const oversizedAssets = allFiles
    .map((filePath) => ({ filePath, size: fs.statSync(filePath).size }))
    .filter((asset) => asset.size > SINGLE_ASSET_BUDGET_BYTES)
    .sort((left, right) => right.size - left.size);

  for (const asset of oversizedAssets) {
    failures.push(`${relativeForLog(asset.filePath)} ${formatBytes(asset.size)} exceeds single asset budget ${formatBytes(SINGLE_ASSET_BUDGET_BYTES)}`);
  }

  console.log(`[check-weapp-bundle-budget] main package ${formatBytes(mainSize)}`);
  for (const summary of subPackageSummaries) {
    console.log(`[check-weapp-bundle-budget] ${summary}`);
  }

  if (failures.length) {
    console.error('[check-weapp-bundle-budget] failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[check-weapp-bundle-budget] bundle budgets passed.');
}

if (require.main === module) {
  main();
}
