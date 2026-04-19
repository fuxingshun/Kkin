const path = require('path');

const config = {
  projectName: 'kinecho-miniapp',
  date: '2026-04-13',
  sourceRoot: 'src',
  outputRoot: `dist/${process.env.TARO_ENV || 'weapp'}`,
  framework: 'react',
  compiler: {
    type: 'webpack5',
    prebundle: {
      enable: false,
      force: true,
    },
  },
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  alias: {
    '@': path.resolve(__dirname, '..', 'src'),
  },
  defineConstants: {
    __API_BASE_URL__: JSON.stringify(process.env.TARO_APP_API_BASE_URL || 'http://127.0.0.1:8000/api'),
  },
  copy: {
    patterns: [],
    options: {},
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
      },
      url: {
        enable: true,
        config: {
          limit: 10240,
        },
      },
      cssModules: {
        enable: false,
      },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
  },
};

module.exports = function mergeConfig(merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'));
  }

  return merge({}, config, require('./prod'));
};
