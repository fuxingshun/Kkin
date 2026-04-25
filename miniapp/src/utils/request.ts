import Taro from '@tarojs/taro';
import { API_BASE_URL, API_BASE_URLS, API_TOKEN } from '@/config/runtime';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  data?: unknown;
  header?: Record<string, string>;
  timeout?: number;
}

interface UploadOptions {
  filePath: string;
  name?: string;
  formData?: Record<string, string | number>;
}

type QueryValue = string | number | boolean | null | undefined;

const ACTIVE_API_BASE_URL_KEY = 'kin-active-api-base-url';
const DEFAULT_TIMEOUT = 6000;

let activeApiBaseUrl = '';

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = normalizeApiBaseUrl(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function getStoredApiBaseUrl() {
  try {
    const value = Taro.getStorageSync(ACTIVE_API_BASE_URL_KEY);
    return typeof value === 'string' ? normalizeApiBaseUrl(value) : '';
  } catch {
    return '';
  }
}

function setActiveApiBaseUrl(baseUrl: string) {
  const normalized = normalizeApiBaseUrl(baseUrl);
  if (!normalized) {
    return;
  }

  activeApiBaseUrl = normalized;
  try {
    Taro.setStorageSync(ACTIVE_API_BASE_URL_KEY, normalized);
  } catch {
    // Storage can fail in restricted environments; in-memory fallback is enough for this session.
  }
}

export function getActiveApiBaseUrl() {
  return normalizeApiBaseUrl(activeApiBaseUrl || getStoredApiBaseUrl() || API_BASE_URLS[0] || API_BASE_URL);
}

export function getActiveApiOrigin() {
  return getActiveApiBaseUrl().replace(/\/api\/?$/, '');
}

function getOrderedApiBaseUrls() {
  return unique([activeApiBaseUrl, getStoredApiBaseUrl(), ...API_BASE_URLS, API_BASE_URL].filter(Boolean));
}

function toCandidateUrls(path: string) {
  if (/^https?:\/\//.test(path)) {
    return [path];
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return getOrderedApiBaseUrls().map((baseUrl) => `${baseUrl}${normalizedPath}`);
}

function getApiBaseFromUrl(url: string) {
  return getOrderedApiBaseUrls().find((baseUrl) => url === baseUrl || url.startsWith(`${baseUrl}/`)) || '';
}

function rememberSuccessfulUrl(url: string) {
  const baseUrl = getApiBaseFromUrl(url);
  if (baseUrl) {
    setActiveApiBaseUrl(baseUrl);
  }
}

function formatAttemptedApiBases(urls: string[]) {
  const bases = unique(urls.map((url) => getApiBaseFromUrl(url) || url));
  if (bases.length <= 1) {
    return '';
  }

  return `\n已尝试接口：\n${bases.join('\n')}`;
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

function extractNetworkError(error: unknown, url: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'object' && error) {
    const errMsg = (error as { errMsg?: unknown }).errMsg;
    if (typeof errMsg === 'string' && errMsg.trim()) {
      if (errMsg.includes('timeout') || errMsg.includes('ERR_CONNECTION_TIMED_OUT')) {
        return `连接后端超时，请确认手机和电脑在同一网络，并且 ${url} 可访问`;
      }

      if (errMsg.includes('url not in domain list') || errMsg.includes('domain')) {
        return `请求域名未通过微信校验，请在开发者工具开启“不校验合法域名”或配置合法域名：${url}`;
      }

      if (errMsg.includes('fail')) {
        return `网络请求失败：${errMsg}`;
      }

      return errMsg;
    }
  }

  return `网络请求失败，请检查后端服务和手机网络：${url}`;
}

function authHeaders() {
  const token = API_TOKEN.trim();
  return token
    ? {
        Authorization: `Bearer ${token}`,
        'X-KinEcho-Token': token,
      }
    : {};
}

export function buildQueryString(params: Record<string, QueryValue>) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

export async function request<T>(path: string, options: RequestOptions = {}) {
  const candidateUrls = toCandidateUrls(path);
  const attemptedUrls: string[] = [];
  let lastError: unknown;

  for (const url of candidateUrls) {
    attemptedUrls.push(url);
    let response: Taro.request.SuccessCallbackResult<T>;

    try {
      response = await Taro.request<T>({
        url,
        method: options.method || 'GET',
        data: options.data,
        timeout: options.timeout || DEFAULT_TIMEOUT,
        header: {
          'Content-Type': 'application/json',
          ...authHeaders(),
          ...options.header,
        },
      });
    } catch (error) {
      lastError = error;
      if (attemptedUrls.length >= candidateUrls.length) {
        const message = extractNetworkError(error, url);
        throw new Error(`${message}${formatAttemptedApiBases(attemptedUrls)}`);
      }

      continue;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      rememberSuccessfulUrl(url);
      return response.data;
    }

    lastError = new Error(extractErrorMessage(response.data, `请求失败：${response.statusCode}`));
    if (response.statusCode < 500 || attemptedUrls.length >= candidateUrls.length) {
      throw lastError;
    }
  }

  const lastUrl = attemptedUrls[attemptedUrls.length - 1] || path;
  throw new Error(`${extractNetworkError(lastError, lastUrl)}${formatAttemptedApiBases(attemptedUrls)}`);
}

export async function uploadFile<T>(path: string, options: UploadOptions) {
  const candidateUrls = toCandidateUrls(path);
  const attemptedUrls: string[] = [];
  let lastError: unknown;

  for (const url of candidateUrls) {
    attemptedUrls.push(url);
    let response: Taro.uploadFile.SuccessCallbackResult;

    try {
      response = await Taro.uploadFile({
        url,
        filePath: options.filePath,
        name: options.name || 'file',
        formData: options.formData,
        timeout: DEFAULT_TIMEOUT,
        header: authHeaders(),
      });
    } catch (error) {
      lastError = error;
      if (attemptedUrls.length >= candidateUrls.length) {
        const message = extractNetworkError(error, url);
        throw new Error(`${message}${formatAttemptedApiBases(attemptedUrls)}`);
      }

      continue;
    }

    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      rememberSuccessfulUrl(url);
      return data as T;
    }

    lastError = new Error(extractErrorMessage(data, `上传失败：${response.statusCode}`));
    if (response.statusCode < 500 || attemptedUrls.length >= candidateUrls.length) {
      throw lastError;
    }
  }

  const lastUrl = attemptedUrls[attemptedUrls.length - 1] || path;
  throw new Error(`${extractNetworkError(lastError, lastUrl)}${formatAttemptedApiBases(attemptedUrls)}`);
}
