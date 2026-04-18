import Taro from '@tarojs/taro';
import { API_ORIGIN } from '@/config/runtime';

const DEVTOOLS_LOCAL_ORIGIN = 'http://127.0.0.1:8000';

function isDevtools() {
  try {
    return Taro.getSystemInfoSync().platform === 'devtools';
  } catch (error) {
    return false;
  }
}

export function getMiniappAssetOrigin() {
  return isDevtools() ? DEVTOOLS_LOCAL_ORIGIN : API_ORIGIN;
}

function getFileName(filePath: string) {
  return filePath.split(/[/\\]/).pop() || filePath;
}

export function getUploadMediaUrl(filePath: string) {
  return `${getMiniappAssetOrigin()}/uploads/${getFileName(filePath)}`;
}

export function getUploadThumbnailUrl(thumbnailPath: string) {
  return `${getMiniappAssetOrigin()}/uploads/thumbnails/${getFileName(thumbnailPath)}`;
}

