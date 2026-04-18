import { DEFAULT_FAMILY_ID } from '@/config/runtime';
import { getUploadMediaUrl, getUploadThumbnailUrl } from '@/utils/media';
import { buildQueryString, request, uploadFile } from '@/utils/request';

export type MoodType = 'happy' | 'calm' | 'sad' | 'anxious' | 'angry' | 'tired';

export interface FamilyMessage {
  id: number;
  family_id: string;
  content: string;
  sender_name: string;
  sender_relation: string;
  scheduled_time: string;
  played: boolean;
  played_at?: string;
  liked: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FamilyAlert {
  id: number;
  family_id: string;
  elderly_id?: number;
  elderly_name?: string;
  alert_type: 'sos_emergency' | 'contact_family' | 'medication' | 'emotion' | 'inactive' | 'emergency';
  level: 'low' | 'medium' | 'high';
  title?: string;
  message: string;
  source: 'elderly' | 'system' | 'family';
  handled: boolean;
  handled_at?: string;
  handler_name?: string;
  reply_message?: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Schedule {
  id?: number;
  family_id: string;
  title: string;
  description?: string;
  schedule_type?: 'medication' | 'exercise' | 'meal' | 'checkup' | 'other';
  schedule_time: string;
  repeat_type?: 'once' | 'daily' | 'weekly' | 'monthly';
  repeat_days?: string;
  status?: 'pending' | 'completed' | 'skipped' | 'missed';
  auto_remind?: number;
}

export interface Media {
  id: number;
  family_id: string;
  media_type: 'photo' | 'video';
  title: string;
  description?: string;
  file_path: string;
  thumbnail_path?: string;
  tags: string[];
  time_windows: string[];
  moods: string[];
  occasions: string[];
  cooldown: number;
  priority: number;
  play_count: number;
  last_played_at?: string;
  created_at: string;
}

export interface MediaStatistics {
  total_plays: number;
  likes: number;
  dislikes: number;
}

export interface MediaHistoryEntry {
  id: number;
  elderly_id: number;
  elderly_name?: string;
  played_at: string;
  duration_watched: number;
  completed: number;
  triggered_by: string;
  mood_before?: string;
  mood_after?: string;
  feedback_type?: 'like' | 'dislike' | null;
}

export interface MediaDetail extends Media {
  statistics: MediaStatistics;
  history: MediaHistoryEntry[];
}

export interface RecentPlay {
  id: number;
  title: string;
  media_type: 'photo' | 'video';
  thumbnail_path: string | null;
  played_at: string;
  likes: number;
  dislikes: number;
}

export interface MoodRecord {
  id?: number;
  family_id: string;
  elderly_id?: number;
  elderly_name?: string;
  mood_type: MoodType;
  mood_score: number;
  note?: string;
  recorded_at?: string;
  created_at?: string;
}

export interface MoodStatsResponse {
  mood_type_stats: Array<{
    mood_type: MoodType;
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

export interface FamilyUser {
  id: number;
  user_type: 'family' | 'elderly' | string;
  name: string;
  phone?: string;
  family_id: string;
  created_at?: string;
}

export interface Counselor {
  id: number;
  name: string;
  title: string;
  experience?: string;
  specialty?: string;
  rating?: string;
  avatar?: string;
  available: boolean;
}

export interface Consultation {
  id: number;
  family_id: string;
  elderly_id?: number;
  counselor_id?: number;
  counselor_name?: string;
  counselor_title?: string;
  counselor_avatar?: string;
  consultation_type: 'phone' | 'video' | 'text' | string;
  scheduled_time: string;
  duration: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | string;
  note?: string;
  created_at?: string;
}

export const moodLabelMap: Record<MoodType, string> = {
  happy: '开心',
  calm: '平稳',
  sad: '难过',
  anxious: '焦虑',
  angry: '生气',
  tired: '疲惫',
};

export const moodEmojiMap: Record<MoodType, string> = {
  happy: '开心',
  calm: '平稳',
  sad: '难过',
  anxious: '焦虑',
  angry: '生气',
  tired: '疲惫',
};

export const scheduleTypeOptions = [
  { label: '用药', value: 'medication' },
  { label: '运动', value: 'exercise' },
  { label: '饮食', value: 'meal' },
  { label: '复诊', value: 'checkup' },
  { label: '其他', value: 'other' },
] as const;

export const repeatTypeOptions = [
  { label: '单次', value: 'once' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
] as const;

export const mediaTimeWindowOptions = [
  { label: '早餐后', value: '07:00-09:00', hint: '适合一天刚开始时播放' },
  { label: '午后', value: '14:00-17:00', hint: '适合午休后陪伴' },
  { label: '晚间', value: '19:00-21:00', hint: '适合家人视频或回忆内容' },
  { label: '睡前', value: '21:00-22:00', hint: '适合柔和内容放松' },
] as const;

export const mediaOccasionOptions = [
  { label: '无特殊场景', value: '' },
  { label: '生日', value: 'birthday' },
  { label: '纪念日', value: 'anniversary' },
  { label: '服药后奖励', value: 'medication_reward' },
] as const;

export const mediaCooldownOptions = [
  { label: '30 分钟', value: 30 },
  { label: '1 小时', value: 60 },
  { label: '2 小时', value: 120 },
  { label: '1 天', value: 1440 },
] as const;

export const mediaPriorityOptions = [
  { label: '1 级', value: 1 },
  { label: '3 级', value: 3 },
  { label: '5 级', value: 5 },
  { label: '8 级', value: 8 },
  { label: '10 级', value: 10 },
] as const;

export const alertTypeLabelMap: Record<FamilyAlert['alert_type'], string> = {
  sos_emergency: '紧急求助',
  contact_family: '联系家人',
  medication: '用药提醒',
  emotion: '情绪波动',
  inactive: '长时间未活动',
  emergency: '异常事件',
};

export function getMediaUrl(filePath: string) {
  return getUploadMediaUrl(filePath);
}

export function getThumbnailUrl(thumbnailPath: string) {
  return getUploadThumbnailUrl(thumbnailPath);
}

export async function getFamilyMessages(familyId = DEFAULT_FAMILY_ID) {
  const data = await request<{ messages: FamilyMessage[] }>(`/family/messages?family_id=${familyId}`);
  return data.messages || [];
}

export async function createMessage(payload: {
  family_id: string;
  content: string;
  sender_name: string;
  sender_relation: string;
  scheduled_time: string;
}) {
  const data = await request<{ message_id: number }>('/family/messages', {
    method: 'POST',
    data: payload,
  });
  return data.message_id;
}

export async function deleteMessage(messageId: number) {
  const data = await request<{ success: boolean }>(`/family/messages/${messageId}`, {
    method: 'DELETE',
  });
  return data.success;
}

export async function getFamilyAlerts(
  familyId = DEFAULT_FAMILY_ID,
  options: {
    handled?: boolean;
    read?: boolean;
    elderlyId?: number;
    level?: string;
    limit?: number;
  } = {}
) {
  const params = buildQueryString({
    family_id: familyId,
    handled: options.handled,
    read: options.read,
    elderly_id: options.elderlyId,
    level: options.level,
    limit: options.limit,
  });

  const data = await request<{ alerts: FamilyAlert[]; total: number }>(`/family/alerts?${params}`);
  return data;
}

export async function markAlertAsRead(alertId: number) {
  const data = await request<{ success: boolean }>(`/family/alerts/${alertId}/read`, {
    method: 'POST',
  });
  return data.success;
}

export async function handleAlert(
  alertId: number,
  payload: {
    handled_by?: number;
    reply_message?: string;
  } = {}
) {
  const data = await request<{ success: boolean }>(`/family/alerts/${alertId}/handle`, {
    method: 'POST',
    data: payload,
  });
  return data.success;
}

export async function getAlertStats(familyId = DEFAULT_FAMILY_ID) {
  return request<{
    today_count: number;
    status_stats: {
      unread: number;
      unhandled: number;
      handled: number;
    };
    level_stats: Record<string, number>;
    type_stats: Record<string, number>;
  }>(`/family/alerts/stats?family_id=${familyId}`);
}

export async function getFamilyUsers(familyId = DEFAULT_FAMILY_ID) {
  const data = await request<{ users: FamilyUser[] }>(`/users/${familyId}`);
  return data.users || [];
}

export async function getCounselors() {
  const data = await request<{ counselors: Counselor[] }>('/counselors');
  return data.counselors || [];
}

export async function getFamilyConsultations(familyId = DEFAULT_FAMILY_ID, limit = 20) {
  const params = buildQueryString({
    family_id: familyId,
    limit: String(limit),
  });
  const data = await request<{ consultations: Consultation[] }>(`/consultations?${params}`);
  return data.consultations || [];
}

export async function createFamilyConsultation(payload: {
  family_id?: string;
  elderly_id?: number;
  counselor_id?: number;
  consultation_type: 'phone' | 'video' | 'text';
  scheduled_time: string;
  duration?: number;
  status?: Consultation['status'];
  note?: string;
}) {
  const data = await request<{ consultation_id: number }>('/consultations', {
    method: 'POST',
    data: {
      family_id: payload.family_id || DEFAULT_FAMILY_ID,
      elderly_id: payload.elderly_id,
      counselor_id: payload.counselor_id,
      consultation_type: payload.consultation_type,
      scheduled_time: payload.scheduled_time,
      duration: payload.duration ?? 45,
      status: payload.status ?? 'scheduled',
      note: payload.note || '',
    },
  });
  return data.consultation_id;
}

export async function updateFamilyConsultation(
  consultationId: number,
  payload: {
    consultation_type?: Consultation['consultation_type'];
    scheduled_time?: string;
    duration?: number;
    status?: Consultation['status'];
    note?: string;
    counselor_id?: number;
  }
) {
  const data = await request<{ success: boolean }>(`/consultations/${consultationId}`, {
    method: 'PUT',
    data: payload,
  });
  return data.success;
}

export async function getFamilySchedules(familyId = DEFAULT_FAMILY_ID) {
  const data = await request<{ schedules: Schedule[] }>(`/family/schedules?family_id=${familyId}`);
  return data.schedules || [];
}

export async function createSchedule(payload: Schedule) {
  const data = await request<{ schedule_id: number }>('/family/schedules', {
    method: 'POST',
    data: payload,
  });
  return data.schedule_id;
}

export async function updateSchedule(
  scheduleId: number,
  payload: Partial<
    Pick<
      Schedule,
      'title' | 'description' | 'schedule_type' | 'schedule_time' | 'repeat_type' | 'repeat_days' | 'auto_remind' | 'status'
    >
  >
) {
  const data = await request<{ success: boolean }>(`/family/schedules/${scheduleId}`, {
    method: 'PUT',
    data: payload,
  });
  return data.success;
}

export async function deleteSchedule(scheduleId: number) {
  const data = await request<{ success: boolean }>(`/family/schedules/${scheduleId}`, {
    method: 'DELETE',
  });
  return data.success;
}

export async function getFamilyMedia(familyId = DEFAULT_FAMILY_ID) {
  const data = await request<{ media: Media[] }>(`/family/media?family_id=${familyId}`);
  return data.media || [];
}

export async function uploadMedia(payload: {
  filePath: string;
  family_id: string;
  title: string;
  description?: string;
}) {
  return uploadFile<{ media_id: number; file_path: string; media_type: string }>('/family/media', {
    filePath: payload.filePath,
    formData: {
      family_id: payload.family_id,
      title: payload.title,
      description: payload.description || '',
    },
  });
}

export async function deleteMedia(mediaId: number) {
  await request(`/family/media/${mediaId}`, {
    method: 'DELETE',
  });
}

export async function getMediaDetail(mediaId: number) {
  return request<MediaDetail>(`/family/media/${mediaId}`);
}

export async function updateMedia(
  mediaId: number,
  payload: {
    title?: string;
    description?: string;
    tags?: string[];
    time_windows?: string[];
    moods?: MoodType[];
    occasions?: string[];
    cooldown?: number;
    priority?: number;
  }
) {
  await request(`/family/media/${mediaId}`, {
    method: 'PUT',
    data: payload,
  });
}

export async function getRecentPlays(familyId = DEFAULT_FAMILY_ID, limit = 3) {
  const data = await request<{ recent_plays: RecentPlay[] }>(
    `/family/media/recent-plays?family_id=${familyId}&limit=${limit}`
  );
  return data.recent_plays || [];
}

export async function getFamilyMoods(familyId = DEFAULT_FAMILY_ID, limit = 20) {
  const data = await request<{ records: MoodRecord[] }>(`/family/moods?family_id=${familyId}&limit=${limit}`);
  return data.records || [];
}

export async function queryFamilyMoodRecords(
  familyId = DEFAULT_FAMILY_ID,
  options: {
    elderlyId?: number;
    limit?: number;
  } = {}
) {
  const params = buildQueryString({
    family_id: familyId,
    elderly_id: options.elderlyId,
    limit: options.limit ?? 20,
  });
  const data = await request<{ records: MoodRecord[] }>(`/family/moods?${params}`);
  return data.records || [];
}

export async function getMoodStats(familyId = DEFAULT_FAMILY_ID, days = 7) {
  return request<MoodStatsResponse>(`/family/moods/stats?family_id=${familyId}&days=${days}`);
}
