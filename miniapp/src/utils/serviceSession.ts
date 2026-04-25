import Taro from '@tarojs/taro';
import { DEFAULT_FAMILY_ID } from '@/config/runtime';

export interface ServiceSession {
  role: 'service';
  username?: string;
  displayName?: string;
  familyId: string;
}

const SERVICE_SESSION_KEY = 'kin-service-session';

function normalizeText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeFamilyId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_FAMILY_ID;
}

export function getServiceSession(): ServiceSession {
  const stored = Taro.getStorageSync(SERVICE_SESSION_KEY) as Partial<ServiceSession> | undefined;
  return {
    role: 'service',
    username: normalizeText(stored?.username),
    displayName: normalizeText(stored?.displayName) || '服务专员',
    familyId: normalizeFamilyId(stored?.familyId),
  };
}

export function saveServiceSession(session: Partial<ServiceSession>) {
  const current = getServiceSession();
  const next: ServiceSession = {
    role: 'service',
    username: normalizeText(session.username ?? current.username),
    displayName: normalizeText(session.displayName ?? current.displayName) || '服务专员',
    familyId: normalizeFamilyId(session.familyId ?? current.familyId),
  };
  Taro.setStorageSync(SERVICE_SESSION_KEY, next);
  return next;
}

export function clearServiceSession() {
  Taro.removeStorageSync(SERVICE_SESSION_KEY);
}

export function getCurrentServiceFamilyId(explicitFamilyId?: string) {
  if (typeof explicitFamilyId === 'string' && explicitFamilyId.trim()) {
    return explicitFamilyId.trim();
  }
  return getServiceSession().familyId || DEFAULT_FAMILY_ID;
}
