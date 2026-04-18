const env = (import.meta as any).env || {};

export const API_BASE_URL: string = env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
export const API_ORIGIN: string = API_BASE_URL.replace(/\/api\/?$/, '');

export const FAY_HTTP_BASE_URL: string =
  env.VITE_FAY_HTTP_BASE_URL || 'http://127.0.0.1:5000';

export const FAY_WS_URL: string =
  env.VITE_FAY_WS_URL || 'ws://127.0.0.1:10002';
