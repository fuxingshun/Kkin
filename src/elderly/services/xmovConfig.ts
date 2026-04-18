/**
 * Configuration service for xmov credentials
 */

import { XmovConfig } from '../types/xmov';

const DEFAULT_GATEWAY = 'https://nebula-agent.xingyun3d.com/user/v1/ttsa/session';

export const getXmovConfig = (): XmovConfig => {
  const storedAppId = localStorage.getItem('XMOV_APP_ID');
  const storedAppSecret = localStorage.getItem('XMOV_APP_SECRET');

  const envAppId = (import.meta as any).env?.VITE_XMOV_APP_ID || '';
  const envAppSecret = (import.meta as any).env?.VITE_XMOV_APP_SECRET || '';

  const appId = envAppId || storedAppId;
  const appSecret = envAppSecret || storedAppSecret;

  return {
    appId,
    appSecret,
    gatewayServer: DEFAULT_GATEWAY,
  };
};

export const setXmovConfig = (appId: string, appSecret: string): void => {
  localStorage.setItem('XMOV_APP_ID', appId);
  localStorage.setItem('XMOV_APP_SECRET', appSecret);
};

export const isXmovConfigValid = (config: XmovConfig): boolean => {
  return !!config.appId && !!config.appSecret && config.appId.trim() !== '' && config.appSecret.trim() !== '';
};

export const clearXmovConfig = (): void => {
  localStorage.removeItem('XMOV_APP_ID');
  localStorage.removeItem('XMOV_APP_SECRET');
};
