import Taro from '@tarojs/taro';
import { request } from '@/utils/request';

export type AuthRole = 'elderly' | 'family' | 'service' | 'admin';

export interface LoginResult {
  success: boolean;
  role: AuthRole;
  user_id?: number;
  username?: string;
  display_name?: string;
  family_id?: string;
  elderly_id?: number;
  elderly_name?: string;
  family_user_id?: number;
  family_name?: string;
}

export async function login(role: AuthRole, username: string, password: string) {
  return request<LoginResult>('/auth/login', {
    method: 'POST',
    data: {
      role,
      username: username.trim(),
      password: password.trim(),
    },
  });
}

export interface WechatProfile {
  nickName?: string;
  avatarUrl?: string;
}

export async function loginWithWechat(role: Exclude<AuthRole, 'admin'>, profile?: WechatProfile) {
  const result = await Taro.login({ timeout: 10000 });

  if (!result.code) {
    throw new Error('微信登录凭证获取失败');
  }

  return request<LoginResult>('/auth/wechat-login', {
    method: 'POST',
    data: {
      role,
      code: result.code,
      user_info: profile,
    },
  });
}
