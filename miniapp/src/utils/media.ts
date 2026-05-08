import Taro from '@tarojs/taro';
import { getActiveApiOrigin } from '@/utils/request';

const DEVTOOLS_LOCAL_ORIGIN = 'http://127.0.0.1:8000';

function isDevtools() {
  try {
    return Taro.getSystemInfoSync().platform === 'devtools';
  } catch (error) {
    return false;
  }
}

export function getMiniappAssetOrigin() {
  return isDevtools() ? DEVTOOLS_LOCAL_ORIGIN : getActiveApiOrigin();
}

function toAssetUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  if (path.startsWith('/api/')) {
    return `${getMiniappAssetOrigin()}${path}`;
  }
  return '';
}

export function getUploadMediaUrl(filePath: string) {
  return toAssetUrl(filePath);
}

export function getUploadThumbnailUrl(thumbnailPath: string) {
  return toAssetUrl(thumbnailPath);
}
