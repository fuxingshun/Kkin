module.exports = function postcssUrlSafe() {
  return {
    postcssPlugin: 'postcss-url',
    Once() {}
  };
};

module.exports.postcss = true;
