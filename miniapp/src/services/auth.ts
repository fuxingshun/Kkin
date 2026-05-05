import Taro from '@tarojs/taro';
import { request } from '@/utils/request';

export type AuthRole = 'elderly' | 'family' | 'service' | 'admin';

export interface LoginResult {
  success: boolean;
  role: AuthRole;
  openid?: string;
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

export type EntranceRole = Exclude<AuthRole, 'admin'>;

export interface WechatSessionResult {
  success: boolean;
  openid: string;
  unionid?: string;
  selected_role: EntranceRole;
}

export interface WechatIdentityUser {
  has_role: boolean;
  user_id?: number;
  family_user_id?: number;
  name?: string;
  display_name?: string;
  family_id?: string;
  elderly_id?: number;
  elderly_name?: string;
  bound_elderly?: boolean;
  binding_code?: string;
}

export interface WechatServiceIdentity {
  has_role: boolean;
  certified: boolean;
  status: 'none' | 'pending' | 'approved' | 'rejected';
  username?: string;
  display_name?: string;
  family_id?: string;
  organization?: string;
  staff_no?: string;
  phone?: string;
  reason?: string;
}

export interface WechatIdentityStatus {
  success: boolean;
  openid: string;
  roles: EntranceRole[];
  elderly: WechatIdentityUser;
  family: WechatIdentityUser;
  service: WechatServiceIdentity;
}

export async function openWechatSession(role: EntranceRole, profile?: WechatProfile) {
  const result = await Taro.login({ timeout: 10000 });

  if (!result.code) {
    throw new Error('微信登录凭证获取失败');
  }

  return request<WechatSessionResult>('/auth/wechat-openid', {
    method: 'POST',
    data: {
      role,
      code: result.code,
      user_info: profile,
    },
  });
}

export async function queryWechatIdentity(openid: string) {
  return request<WechatIdentityStatus>(`/auth/wechat-identity?openid=${encodeURIComponent(openid)}`);
}

export async function submitServiceCertification(payload: {
  openid: string;
  name: string;
  phone: string;
  staff_no: string;
  organization: string;
}) {
  return request<{ success: boolean; status: WechatServiceIdentity['status'] }>('/auth/service-certification', {
    method: 'POST',
    data: {
      openid: payload.openid.trim(),
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      staff_no: payload.staff_no.trim(),
      organization: payload.organization.trim(),
    },
  });
}
