const path = require('path');
const { spawn } = require('child_process');
const { ensureWeappPageWxss } = require('./ensure-weapp-page-wxss');
const { patchWeappTaroNodeGetters } = require('./patch-weapp-taro-node-getters');

const projectRoot = path.resolve(__dirname, '..');
const taroBin = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'taro.cmd' : 'taro'
);

let lastCreated = -1;
let lastTaroPatchState = '';

const taroArgs = ['build', '--type', 'weapp', '--watch'];
const watcherCommand = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : taroBin;
const watcherArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', taroBin, ...taroArgs]
  : taroArgs;

const watcher = spawn(watcherCommand, watcherArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
});

const timer = setInterval(() => {
  try {
    const result = ensureWeappPageWxss();
    if (!result.skipped && result.created !== lastCreated) {
      lastCreated = result.created;
      console.log(
        `[dev-weapp] ensured ${result.pages} pages, created ${result.created} missing wxss file(s).`
      );
    }

    const taroPatchResult = patchWeappTaroNodeGetters();
    const taroPatchState = `${taroPatchResult.patched}:${taroPatchResult.reason}`;
    if (taroPatchState !== lastTaroPatchState) {
      lastTaroPatchState = taroPatchState;
      if (taroPatchResult.patched) {
        console.log('[dev-weapp] patched taro firstChild/lastChild getters for real-device stability.');
      } else if (!taroPatchResult.skipped) {
        console.log(`[dev-weapp] taro getter patch status: ${taroPatchResult.reason}.`);
      }
    }

  } catch (error) {
    console.error('[dev-weapp] failed to ensure wxss files:', error.message);
  }
}, 1500);

function shutdown(signal) {
  clearInterval(timer);
  if (!watcher.killed) {
    watcher.kill(signal);
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

watcher.on('exit', (code) => {
  clearInterval(timer);
  process.exit(code || 0);
});
