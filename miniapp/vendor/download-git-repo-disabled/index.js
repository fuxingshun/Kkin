module.exports = function downloadGitRepoDisabled(repo, destination, options, callback) {
  var done = typeof options === 'function' ? options : callback;
  var error = new Error(
    'download-git-repo is disabled in this project. KinEcho only permits the Taro build path in CI.'
  );
  if (typeof done === 'function') {
    done(error);
    return;
  }
  throw error;
};
