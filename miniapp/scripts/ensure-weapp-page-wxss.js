const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist', 'weapp');
const appJsonPath = path.join(distRoot, 'app.json');

function ensureFile(filePath, content) {
  if (fs.existsSync(filePath)) {
    return false;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function ensureWeappPageWxss() {
  if (!fs.existsSync(appJsonPath)) {
    return {
      pages: 0,
      created: 0,
      skipped: true,
    };
  }

  const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const pages = Array.isArray(appConfig.pages) ? appConfig.pages : [];
  let created = 0;

  for (const page of pages) {
    const wxssPath = path.join(distRoot, `${page}.wxss`);
    if (ensureFile(wxssPath, '/* generated placeholder for WeChat DevTools */\n')) {
      created += 1;
    }
  }

  return {
    pages: pages.length,
    created,
    skipped: false,
  };
}

function main() {
  const result = ensureWeappPageWxss();

  if (result.skipped) {
    console.warn('[ensure-weapp-page-wxss] app.json not found, skipped.');
    return;
  }

  console.log(
    `[ensure-weapp-page-wxss] ensured ${result.pages} pages, created ${result.created} wxss file(s).`
  );
}

module.exports = {
  ensureWeappPageWxss,
};

if (require.main === module) {
  main();
}
