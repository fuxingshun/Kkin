const path = require('path');
const os = require('os');

function normalizeApiBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getDetectedLanApiBaseUrls() {
  const ignoredInterfacePattern = /vmware|virtualbox|veth|docker|loopback|wsl|hyper-v/i;
  const candidates = [];
  const interfaces = os.networkInterfaces();

  Object.entries(interfaces).forEach(([name, addresses]) => {
    if (ignoredInterfacePattern.test(name) || !Array.isArray(addresses)) {
      return;
    }

    addresses.forEach((address) => {
      if (!address || address.family !== 'IPv4' || address.internal) {
        return;
      }

      const ip = address.address;
      const isPrivateLan =
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);

      if (isPrivateLan) {
        const priority = ip.startsWith('192.168.') ? 0 : /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ? 1 : 2;
        candidates.push({
          priority,
          url: `http://${ip}:8000/api`,
        });
      }
    });
  });

  return candidates.sort((left, right) => left.priority - right.priority).map((candidate) => candidate.url);
}

function getApiBaseUrls() {
  const configured = (process.env.TARO_APP_API_BASE_URLS || process.env.TARO_APP_API_BASE_URL || '')
    .split(',')
    .map(normalizeApiBaseUrl)
    .filter(Boolean);

  const candidates = configured.length ? configured : ['http://127.0.0.1:8000/api'];
  const withLanFallbacks = [...candidates, ...getDetectedLanApiBaseUrls()];

  return Array.from(new Set(withLanFallbacks.map(normalizeApiBaseUrl).filter(Boolean)));
}

const apiBaseUrls = getApiBaseUrls();

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
    __API_BASE_URL__: JSON.stringify(apiBaseUrls[0]),
    __API_BASE_URLS__: JSON.stringify(apiBaseUrls),
    __API_TOKEN__: JSON.stringify(process.env.TARO_APP_API_TOKEN || ''),
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
