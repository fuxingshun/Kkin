import Taro from '@tarojs/taro';
import { DEFAULT_FAMILY_ID } from '@/config/runtime';

export interface FamilySession {
  familyId: string;
  familyUserId?: number;
  familyName?: string;
  elderlyId?: number;
  elderlyName?: string;
  bindingCode?: string;
  wechatOpenid?: string;
  sessionToken?: string;
}

const FAMILY_SESSION_KEY = 'kin-family-session';

function normalizeFamilyId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_FAMILY_ID;
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getFamilySession(): FamilySession {
  const stored = Taro.getStorageSync(FAMILY_SESSION_KEY) as Partial<FamilySession> | undefined;
  return {
    familyId: normalizeFamilyId(stored?.familyId),
    familyUserId: normalizeNumber(stored?.familyUserId),
    familyName: normalizeText(stored?.familyName),
    elderlyId: normalizeNumber(stored?.elderlyId),
    elderlyName: normalizeText(stored?.elderlyName),
    bindingCode: normalizeText(stored?.bindingCode),
    wechatOpenid: normalizeText(stored?.wechatOpenid),
    sessionToken: normalizeText(stored?.sessionToken),
  };
}

export function hasFamilySessionContext(session = getFamilySession()) {
  return Boolean(
    session.sessionToken ||
      session.familyUserId ||
      session.familyName ||
      (session.familyId && session.familyId !== DEFAULT_FAMILY_ID)
  );
}

export function requireCurrentFamilyId(session = getFamilySession()) {
  if (!hasFamilySessionContext(session)) {
    throw new Error('请先以家属身份登录');
  }

  return session.familyId;
}

export function saveFamilySession(session: Partial<FamilySession>) {
  const current = getFamilySession();
  const next: FamilySession = {
    familyId: normalizeFamilyId(session.familyId ?? current.familyId),
    familyUserId: normalizeNumber(session.familyUserId ?? current.familyUserId),
    familyName: normalizeText(session.familyName ?? current.familyName),
    elderlyId: normalizeNumber(session.elderlyId ?? current.elderlyId),
    elderlyName: normalizeText(session.elderlyName ?? current.elderlyName),
    bindingCode: normalizeText(session.bindingCode ?? current.bindingCode),
    wechatOpenid: normalizeText(session.wechatOpenid ?? current.wechatOpenid),
    sessionToken: normalizeText(session.sessionToken ?? current.sessionToken),
  };
  Taro.setStorageSync(FAMILY_SESSION_KEY, next);
  return next;
}

export function clearFamilySession() {
  Taro.removeStorageSync(FAMILY_SESSION_KEY);
}

export function getCurrentFamilyId(explicitFamilyId?: string) {
  if (explicitFamilyId && explicitFamilyId.trim()) {
    return explicitFamilyId.trim();
  }
  return getFamilySession().familyId || DEFAULT_FAMILY_ID;
}
