const env = (import.meta as any).env || {};

export const API_BASE_URL: string = env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
export const API_ORIGIN: string = API_BASE_URL.replace(/\/api\/?$/, '');

export const FAY_HTTP_BASE_URL: string =
  env.VITE_FAY_HTTP_BASE_URL || 'http://127.0.0.1:5000';

export const FAY_WS_URL: string =
  env.VITE_FAY_WS_URL || 'ws://127.0.0.1:10002';

const parsedDefaultElderlyId = Number(env.VITE_DEFAULT_ELDERLY_ID);

export const DEFAULT_FAMILY_ID: string = env.VITE_DEFAULT_FAMILY_ID || 'family_001';
export const DEFAULT_ELDERLY_ID: number =
  Number.isFinite(parsedDefaultElderlyId) && parsedDefaultElderlyId > 0 ? parsedDefaultElderlyId : 1;
export const DEFAULT_ELDERLY_NAME: string = env.VITE_DEFAULT_ELDERLY_NAME || '张翠花';
