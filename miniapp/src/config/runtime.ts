declare const __API_BASE_URL__: string;
declare const __API_BASE_URLS__: string[];
declare const __API_TOKEN__: string;

export const API_BASE_URL = __API_BASE_URL__;
export const API_BASE_URLS = Array.isArray(__API_BASE_URLS__) && __API_BASE_URLS__.length ? __API_BASE_URLS__ : [API_BASE_URL];
export const API_TOKEN = __API_TOKEN__;

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export const DEFAULT_FAMILY_ID = 'family_001';
export const DEFAULT_ELDERLY_ID = 1;
export const DEFAULT_ELDER_NAME = '张奶奶';
export const DEFAULT_CHAT_USERNAME = 'User';
