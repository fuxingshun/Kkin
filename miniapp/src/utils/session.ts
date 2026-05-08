import Taro from '@tarojs/taro';
import {
  DEFAULT_ELDERLY_ID,
  DEFAULT_ELDER_NAME,
  DEFAULT_FAMILY_ID,
} from '@/config/runtime';

export type AppRole = 'elderly' | 'family' | 'service';

export interface ElderlySession {
  role: AppRole;
  familyId: string;
  elderlyId: number;
  elderName: string;
  wechatOpenid?: string;
  sessionToken?: string;
}

const ELDERLY_SESSION_KEY = 'kin-elderly-session';

function normalizeRole(value: unknown): AppRole {
  if (value === 'family' || value === 'service' || value === 'elderly') {
    return value;
  }

  return 'elderly';
}

function normalizeFamilyId(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return DEFAULT_FAMILY_ID;
}

function normalizeElderlyId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ELDERLY_ID;
}

function normalizeElderName(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return DEFAULT_ELDER_NAME;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getElderlySession(): ElderlySession {
  const stored = Taro.getStorageSync(ELDERLY_SESSION_KEY) as Partial<ElderlySession> | undefined;

  return {
    role: normalizeRole(stored?.role),
    familyId: normalizeFamilyId(stored?.familyId),
    elderlyId: normalizeElderlyId(stored?.elderlyId),
    elderName: normalizeElderName(stored?.elderName),
    wechatOpenid: normalizeText(stored?.wechatOpenid),
    sessionToken: normalizeText(stored?.sessionToken),
  };
}

export function hasElderlySessionContext(session = getElderlySession()) {
  return Boolean(
    session.sessionToken ||
      session.wechatOpenid ||
      (session.familyId && session.familyId !== DEFAULT_FAMILY_ID) ||
      (session.elderlyId && session.elderlyId !== DEFAULT_ELDERLY_ID)
  );
}

export function requireCurrentElderlyFamilyId(session = getElderlySession()) {
  if (!hasElderlySessionContext(session)) {
    throw new Error('请先以老人身份登录');
  }

  return session.familyId;
}

export function requireCurrentElderlyId(session = getElderlySession()) {
  if (!hasElderlySessionContext(session)) {
    throw new Error('请先以老人身份登录');
  }

  return session.elderlyId;
}

export function saveElderlySession(session: Partial<ElderlySession>) {
  const current = getElderlySession();
  const next: ElderlySession = {
    role: normalizeRole(session.role ?? current.role),
    familyId: normalizeFamilyId(session.familyId ?? current.familyId),
    elderlyId: normalizeElderlyId(session.elderlyId ?? current.elderlyId),
    elderName: normalizeElderName(session.elderName ?? current.elderName),
    wechatOpenid: normalizeText(session.wechatOpenid ?? current.wechatOpenid),
    sessionToken: normalizeText(session.sessionToken ?? current.sessionToken),
  };

  Taro.setStorageSync(ELDERLY_SESSION_KEY, next);
  return next;
}

export function clearElderlySession() {
  Taro.removeStorageSync(ELDERLY_SESSION_KEY);
}

export function getElderlyChatUsername(session = getElderlySession()) {
  const familyPart = session.familyId || 'family';
  const elderlyPart = session.elderlyId || session.wechatOpenid || 'pending';
  return `elderly:${familyPart}:${elderlyPart}`;
}
