export const ADMIN_FAMILY_ID = import.meta.env.VITE_ADMIN_FAMILY_ID || 'family_001';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';

type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
}

export interface ApiUser {
  id: number;
  user_type: 'elderly' | 'family' | string;
  name: string;
  phone?: string;
  family_id: string;
  is_active?: number;
  created_by?: string;
  updated_by?: string;
  deleted_by?: string;
  deleted_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ApiAlert {
  id: number;
  family_id: string;
  elderly_id?: number;
  elderly_name?: string;
  alert_type: string;
  level: 'low' | 'medium' | 'high' | string;
  title?: string;
  message: string;
  handled: boolean;
  read: boolean;
  created_at: string;
}

export interface ApiAlertStats {
  today_count: number;
  status_stats: {
    unread?: number;
    unhandled?: number;
    handled?: number;
  };
  level_stats: Record<string, number>;
  type_stats: Record<string, number>;
}

export interface ApiMedia {
  id: number;
  family_id: string;
  media_type: 'photo' | 'video';
  title: string;
  description?: string;
  file_path: string;
  thumbnail_path?: string;
  tags?: string[];
  play_count?: number;
  priority?: number;
  created_at?: string;
}

export interface ApiMoodStats {
  mood_type_stats: Array<{
    mood_type: string;
    count: number;
    avg_score: number;
  }>;
  daily_stats: Array<{
    date: string;
    avg_score: number;
    count: number;
  }>;
  overall: {
    total_records: number;
    avg_score: number;
    max_score: number;
    min_score: number;
  };
  today_count: number;
  days: number;
}

export interface ApiSchedule {
  id?: number;
  family_id: string;
  title: string;
  status?: string;
}

export interface ApiRecentPlay {
  id: number;
  title: string;
  media_type: 'photo' | 'video';
  played_at: string;
  likes: number;
  dislikes: number;
}

export interface ApiHealth {
  status: string;
  timestamp: string;
  backend: string;
}

export interface ApiAdminServiceSummary {
  family_id: string;
  overview: {
    total_counselors: number;
    available_counselors: number;
    active_consultations: number;
    scheduled_consultations: number;
    pending_alerts: number;
    high_risk_cases: number;
    case_total: number;
  };
  role_stats: Array<{
    role: string;
    count: number;
    available_count: number;
    active_cases: number;
  }>;
  case_rows: Array<{
    elderly_id: number;
    elderly_name: string;
    risk_level: 'low' | 'medium' | 'high' | string;
    open_alerts: number;
    active_consultations: number;
    latest_mood_score: number;
    last_followup_at?: string;
  }>;
}

export interface ApiAdminAnalytics {
  family_id: string;
  months: number;
  days: number;
  summary: {
    total_users: number;
    elderly_users: number;
    family_users: number;
    followups: number;
    media_plays: number;
    mood_records: number;
    avg_mood_score: number;
  };
  user_growth: Array<{
    month: string;
    elderly: number;
    family: number;
    total: number;
  }>;
  weekly_activity: Array<{
    date: string;
    day: string;
    followups: number;
    memory: number;
    mood_records: number;
  }>;
}

export interface ApiLoginResult {
  success: boolean;
  role: 'admin' | string;
  username?: string;
  display_name?: string;
}

function buildQueryString(params: Record<string, QueryValue>) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function toAbsoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

function getErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'object' && data && 'error' in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) {
      return error;
    }
  }

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  return fallback;
}

function authHeaders(): Record<string, string> {
  const token = API_TOKEN.trim();
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-KinEcho-Token'] = token;
  }

  return headers;
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(options.data === undefined ? {} : { 'Content-Type': 'application/json' }),
  };

  const response = await fetch(toAbsoluteUrl(path), {
    method: options.method || 'GET',
    headers: Object.keys(headers).length ? headers : undefined,
    body: options.data === undefined ? undefined : JSON.stringify(options.data),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(getErrorMessage(data, `请求失败�?{response.status}`));
  }

  return data as T;
}

export async function getHealth() {
  return request<ApiHealth>('/health');
}

export async function loginAdmin(username: string, password: string) {
  return request<ApiLoginResult>('/auth/login', {
    method: 'POST',
    data: {
      role: 'admin',
      username: username.trim(),
      password: password.trim(),
    },
  });
}

export async function getAdminServiceSummary(familyId = ADMIN_FAMILY_ID) {
  const query = buildQueryString({ family_id: familyId });
  return request<ApiAdminServiceSummary>(`/admin/service-summary?${query}`);
}

export async function getAdminAnalytics(
  familyId = ADMIN_FAMILY_ID,
  options: {
    months?: number;
    days?: number;
  } = {}
) {
  const query = buildQueryString({
    family_id: familyId,
    months: options.months ?? 6,
    days: options.days ?? 7,
  });
  return request<ApiAdminAnalytics>(`/admin/analytics?${query}`);
}

export async function getUsers(familyId = ADMIN_FAMILY_ID) {
  const data = await request<{ users: ApiUser[] }>(`/users/${familyId}`);
  return data.users || [];
}

export async function createUser(payload: {
  user_type: 'elderly' | 'family';
  name: string;
  phone?: string;
  family_id?: string;
}) {
  const data = await request<{ user_id: number }>('/users', {
    method: 'POST',
    data: {
      family_id: payload.family_id || ADMIN_FAMILY_ID,
      user_type: payload.user_type,
      name: payload.name,
      phone: payload.phone || '',
      operator: 'admin',
    },
  });
  return data.user_id;
}

export async function updateUser(
  userId: number,
  payload: {
    family_id?: string;
    name?: string;
    phone?: string;
  }
) {
  await request<{ success: boolean }>(`/users/${userId}`, {
    method: 'PUT',
    data: {
      ...payload,
      family_id: payload.family_id || ADMIN_FAMILY_ID,
      operator: 'admin',
    },
  });
}

export async function deleteUser(userId: number, familyId = ADMIN_FAMILY_ID) {
  const query = buildQueryString({
    family_id: familyId,
    operator: 'admin',
  });
  await request<{ success: boolean }>(`/users/${userId}?${query}`, {
    method: 'DELETE',
  });
}

export async function getAlerts(
  familyId = ADMIN_FAMILY_ID,
  options: { handled?: boolean; limit?: number } = {}
) {
  const query = buildQueryString({
    family_id: familyId,
    handled: options.handled,
    limit: options.limit ?? 100,
  });
  const data = await request<{ alerts: ApiAlert[]; total: number }>(`/family/alerts?${query}`);
  return data;
}

export async function getAlertStats(familyId = ADMIN_FAMILY_ID) {
  return request<ApiAlertStats>(`/family/alerts/stats?family_id=${encodeURIComponent(familyId)}`);
}

export async function handleAlert(
  alertId: number,
  replyMessage = '管理端已完成处理',
  familyId = ADMIN_FAMILY_ID
) {
  await request<{ success: boolean }>(`/family/alerts/${alertId}/handle`, {
    method: 'POST',
    data: {
      family_id: familyId,
      reply_message: replyMessage,
    },
  });
}


export async function getMedia(familyId = ADMIN_FAMILY_ID) {
  const data = await request<{ media: ApiMedia[] }>(`/family/media?family_id=${encodeURIComponent(familyId)}`);
  return data.media || [];
}

export async function uploadMedia(file: File, title: string, description = '', familyId = ADMIN_FAMILY_ID) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('family_id', familyId);
  formData.append('title', title);
  formData.append('description', description);

  const response = await fetch(toAbsoluteUrl('/family/media'), {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(data, `上传失败�?{response.status}`));
  }

  return data as { media_id: number };
}

export async function getMoodStats(familyId = ADMIN_FAMILY_ID, days = 7) {
  const query = buildQueryString({ family_id: familyId, days });
  return request<ApiMoodStats>(`/family/moods/stats?${query}`);
}

export async function getSchedules(familyId = ADMIN_FAMILY_ID) {
  const data = await request<{ schedules: ApiSchedule[] }>(`/family/schedules?family_id=${encodeURIComponent(familyId)}`);
  return data.schedules || [];
}

export async function getRecentPlays(familyId = ADMIN_FAMILY_ID, limit = 6) {
  const query = buildQueryString({ family_id: familyId, limit });
  const data = await request<{ recent_plays: ApiRecentPlay[] }>(`/family/media/recent-plays?${query}`);
  return data.recent_plays || [];
}

