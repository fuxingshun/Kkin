import { API_BASE_URL, DEFAULT_ELDERLY_ID, DEFAULT_ELDERLY_NAME, DEFAULT_FAMILY_ID } from '../../config/runtime';

export interface ElderlyAppContext {
  familyId: string;
  elderlyId: number;
  elderlyName: string;
}

interface FamilyUser {
  id: number;
  user_type?: string;
  name?: string;
  family_id?: string;
}

const STORAGE_KEY = 'kinecho-elderly-web-context';

function normalizeFamilyId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_FAMILY_ID;
}

function normalizeElderlyId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ELDERLY_ID;
}

function normalizeElderlyName(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_ELDERLY_NAME;
}

function readStoredContext(): Partial<ElderlyAppContext> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as Partial<ElderlyAppContext>;
  } catch (error) {
    console.warn('[contextService] Failed to parse stored elderly context', error);
    return {};
  }
}

function readQueryContext(): Partial<ElderlyAppContext> {
  if (typeof window === 'undefined') {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  const elderlyId = params.get('elderlyId') || params.get('elderly_id') || undefined;

  return {
    familyId: params.get('familyId') || params.get('family_id') || undefined,
    elderlyId: elderlyId ? normalizeElderlyId(elderlyId) : undefined,
    elderlyName: params.get('elderlyName') || params.get('elderly_name') || undefined,
  };
}

function persistContext(context: ElderlyAppContext) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch (error) {
    console.warn('[contextService] Failed to persist elderly context', error);
  }
}

function buildContext(partial: Partial<ElderlyAppContext>): ElderlyAppContext {
  return {
    familyId: normalizeFamilyId(partial.familyId),
    elderlyId: normalizeElderlyId(partial.elderlyId),
    elderlyName: normalizeElderlyName(partial.elderlyName),
  };
}

async function fetchFamilyUsers(familyId: string) {
  const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(familyId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.status}`);
  }

  const data = (await response.json()) as { users?: FamilyUser[] };
  return data.users || [];
}

export function getInitialElderlyContext() {
  return buildContext({
    ...readStoredContext(),
    ...readQueryContext(),
  });
}

export async function resolveElderlyContext(): Promise<ElderlyAppContext> {
  const queryContext = readQueryContext();
  const storedContext = readStoredContext();

  let nextContext = buildContext({
    ...storedContext,
    ...queryContext,
  });

  try {
    const users = await fetchFamilyUsers(nextContext.familyId);
    const elderlyUsers = users.filter((item) => item.user_type === 'elderly');
    const matchedUser =
      elderlyUsers.find((item) => item.id === nextContext.elderlyId) ||
      elderlyUsers.find((item) => item.name && item.name === nextContext.elderlyName) ||
      elderlyUsers[0];

    if (matchedUser) {
      nextContext = {
        familyId: normalizeFamilyId(matchedUser.family_id || nextContext.familyId),
        elderlyId: normalizeElderlyId(matchedUser.id || nextContext.elderlyId),
        elderlyName: normalizeElderlyName(matchedUser.name || nextContext.elderlyName),
      };
    }
  } catch (error) {
    console.warn('[contextService] Falling back to locally resolved elderly context', error);
  }

  persistContext(nextContext);
  return nextContext;
}
