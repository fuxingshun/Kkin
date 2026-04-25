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
