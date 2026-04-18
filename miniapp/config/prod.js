module.exports = {
  env: {
    NODE_ENV: '"production"',
  },
  mini: {
    webpackChain(chain) {
      chain.optimization.minimize(false);
    },
    minifyXML: {
      collapseWhitespace: false,
    },
  },
  terser: {
    enable: false,
  },
  esbuild: {
    minify: {
      enable: false,
    },
  },
  h5: {},
};
