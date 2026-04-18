import Taro from '@tarojs/taro';
import { API_BASE_URL } from '@/config/runtime';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  data?: Record<string, unknown> | string;
  header?: Record<string, string>;
}

interface UploadOptions {
  filePath: string;
  name?: string;
  formData?: Record<string, string | number>;
}

type QueryValue = string | number | boolean | null | undefined;

function toAbsoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

function extractErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (typeof data === 'object' && data && 'error' in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export function buildQueryString(params: Record<string, QueryValue>) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

export async function request<T>(path: string, options: RequestOptions = {}) {
  const response = await Taro.request<T>({
    url: toAbsoluteUrl(path),
    method: options.method || 'GET',
    data: options.data,
    header: {
      'Content-Type': 'application/json',
      ...options.header,
    },
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(extractErrorMessage(response.data, `请求失败：${response.statusCode}`));
  }

  return response.data;
}

export async function uploadFile<T>(path: string, options: UploadOptions) {
  const response = await Taro.uploadFile({
    url: toAbsoluteUrl(path),
    filePath: options.filePath,
    name: options.name || 'file',
    formData: options.formData,
  });

  const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(extractErrorMessage(data, `上传失败：${response.statusCode}`));
  }

  return data as T;
}
