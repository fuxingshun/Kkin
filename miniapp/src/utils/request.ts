import Taro from '@tarojs/taro';
import { API_BASE_URL, API_BASE_URLS, API_TOKEN } from '@/config/runtime';
import { getFamilySession } from '@/utils/familySession';
import { getServiceSession } from '@/utils/serviceSession';
import { getElderlySession } from '@/utils/session';

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
  timeout?: number;
}

type QueryValue = string | number | boolean | null | undefined;
type FamilyScopedSession = {
  familyId: string;
  sessionToken?: string;
};

const ACTIVE_API_BASE_URL_KEY = 'kin-active-api-base-url';
const ACTIVE_API_BASE_URL_SIGNATURE_KEY = 'kin-active-api-base-url-signature';
const DEFAULT_TIMEOUT = 6000;

let activeApiBaseUrl = '';
let cacheSignatureChecked = false;

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

function getKnownApiBaseUrls() {
  return unique([...API_BASE_URLS, API_BASE_URL].filter(Boolean));
}

function getApiBaseUrlSignature() {
  return getKnownApiBaseUrls().join('|');
}

function isKnownApiBaseUrl(baseUrl: string) {
  return getKnownApiBaseUrls().includes(normalizeApiBaseUrl(baseUrl));
}

function ensureApiBaseUrlCacheFresh() {
  if (cacheSignatureChecked) {
    return;
  }

  cacheSignatureChecked = true;
  const signature = getApiBaseUrlSignature();
  try {
    const storedSignature = Taro.getStorageSync(ACTIVE_API_BASE_URL_SIGNATURE_KEY);
    if (storedSignature !== signature) {
      Taro.removeStorageSync(ACTIVE_API_BASE_URL_KEY);
      Taro.setStorageSync(ACTIVE_API_BASE_URL_SIGNATURE_KEY, signature);
      activeApiBaseUrl = '';
    }
  } catch {
    activeApiBaseUrl = '';
  }
}

function getStoredApiBaseUrl() {
  ensureApiBaseUrlCacheFresh();
  try {
    const value = Taro.getStorageSync(ACTIVE_API_BASE_URL_KEY);
    const normalized = typeof value === 'string' ? normalizeApiBaseUrl(value) : '';
    if (!normalized) {
      return '';
    }
    if (!isKnownApiBaseUrl(normalized)) {
      Taro.removeStorageSync(ACTIVE_API_BASE_URL_KEY);
      return '';
    }
    return normalized;
  } catch {
    return '';
  }
}

function setActiveApiBaseUrl(baseUrl: string) {
  const normalized = normalizeApiBaseUrl(baseUrl);
  if (!normalized || !isKnownApiBaseUrl(normalized)) {
    return;
  }

  activeApiBaseUrl = normalized;
  try {
    Taro.setStorageSync(ACTIVE_API_BASE_URL_KEY, normalized);
  } catch {
    // Storage can fail in restricted environments; in-memory fallback is enough for this session.
  }
}

function clearActiveApiBaseUrl(baseUrl: string) {
  const normalized = normalizeApiBaseUrl(baseUrl);
  if (!normalized) {
    return;
  }

  if (normalizeApiBaseUrl(activeApiBaseUrl) === normalized) {
    activeApiBaseUrl = '';
  }

  try {
    const stored = Taro.getStorageSync(ACTIVE_API_BASE_URL_KEY);
    if (typeof stored === 'string' && normalizeApiBaseUrl(stored) === normalized) {
      Taro.removeStorageSync(ACTIVE_API_BASE_URL_KEY);
    }
  } catch {
    activeApiBaseUrl = '';
  }
}

export function getActiveApiBaseUrl() {
  ensureApiBaseUrlCacheFresh();
  return normalizeApiBaseUrl(activeApiBaseUrl || getStoredApiBaseUrl() || API_BASE_URLS[0] || API_BASE_URL);
}

export function getActiveApiOrigin() {
  return getActiveApiBaseUrl().replace(/\/api\/?$/, '');
}

function getOrderedApiBaseUrls() {
  ensureApiBaseUrlCacheFresh();
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

function getApiBaseFromRequestUrl(url: string) {
  const match = url.match(/^(https?:\/\/[^/]+\/api)(?:\/|$)/);
  return normalizeApiBaseUrl(match?.[1] || getApiBaseFromUrl(url));
}

function rememberSuccessfulUrl(url: string) {
  const baseUrl = getApiBaseFromUrl(url);
  if (baseUrl) {
    setActiveApiBaseUrl(baseUrl);
  }
}

function forgetFailedUrl(url: string) {
  clearActiveApiBaseUrl(getApiBaseFromRequestUrl(url));
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
      const asrMessage = (data as { asr_error?: unknown }).asr_error;
      if (typeof asrMessage === 'string' && asrMessage.trim()) {
        return `${message}：${asrMessage}`;
      }
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

function decodeQueryPart(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function extractQueryParam(url: string, key: string) {
  const queryIndex = url.indexOf('?');
  if (queryIndex < 0) {
    return '';
  }

  const query = url.slice(queryIndex + 1).split('#')[0];
  for (const part of query.split('&')) {
    if (!part) {
      continue;
    }

    const [rawKey, ...rawValueParts] = part.split('=');
    if (decodeQueryPart(rawKey) === key) {
      return decodeQueryPart(rawValueParts.join('=')).trim();
    }
  }

  return '';
}

function extractFamilyIdFromPath(url: string) {
  const path = url.split('?')[0].replace(/^https?:\/\/[^/]+/, '').replace(/^\/api(?=\/)/, '');
  const match = path.match(/^\/users\/([^/#]+)$/);
  return match ? decodeQueryPart(match[1]).trim() : '';
}

function extractFamilyIdFromData(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return '';
  }

  const value = (data as Record<string, unknown>).family_id;
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  return '';
}

function getRequestedFamilyId(url: string, data?: unknown) {
  return extractFamilyIdFromData(data) || extractQueryParam(url, 'family_id') || extractFamilyIdFromPath(url);
}

function selectSessionToken(requestedFamilyId: string) {
  const sessions: FamilyScopedSession[] = [getElderlySession(), getFamilySession(), getServiceSession()];
  const sessionsWithToken = sessions.filter((session) => typeof session.sessionToken === 'string' && session.sessionToken.trim());

  if (requestedFamilyId) {
    const matched = sessionsWithToken.find((session) => session.familyId === requestedFamilyId);
    return matched?.sessionToken?.trim() || '';
  }

  return sessionsWithToken[0]?.sessionToken?.trim() || '';
}

function authHeaders(url = '', data?: unknown) {
  const token = API_TOKEN.trim();
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-KinEcho-Token'] = token;
  }

  const sessionToken = selectSessionToken(getRequestedFamilyId(url, data));
  if (sessionToken) {
    headers['X-KinEcho-Session'] = sessionToken;
  }

  return headers;
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
    let response: Taro.request.SuccessCallbackResult<Record<string, unknown>>;

    try {
      response = await Taro.request<Record<string, unknown>>({
        url,
        method: options.method || 'GET',
        data: options.data,
        timeout: options.timeout || DEFAULT_TIMEOUT,
        header: {
          'Content-Type': 'application/json',
          ...authHeaders(url, options.data),
          ...options.header,
        },
      });
    } catch (error) {
      lastError = error;
      forgetFailedUrl(url);
      if (attemptedUrls.length >= candidateUrls.length) {
        const message = extractNetworkError(error, url);
        throw new Error(`${message}${formatAttemptedApiBases(attemptedUrls)}`);
      }

      continue;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      rememberSuccessfulUrl(url);
      return response.data as T;
    }

    lastError = new Error(extractErrorMessage(response.data, `请求失败：${response.statusCode}`));
    if (response.statusCode >= 500) {
      forgetFailedUrl(url);
    }
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
        timeout: options.timeout || DEFAULT_TIMEOUT,
        header: authHeaders(url, options.formData),
      });
    } catch (error) {
      lastError = error;
      forgetFailedUrl(url);
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
    if (response.statusCode >= 500) {
      forgetFailedUrl(url);
    }
    if (response.statusCode < 500 || attemptedUrls.length >= candidateUrls.length) {
      throw lastError;
    }
  }

  const lastUrl = attemptedUrls[attemptedUrls.length - 1] || path;
  throw new Error(`${extractNetworkError(lastError, lastUrl)}${formatAttemptedApiBases(attemptedUrls)}`);
}
