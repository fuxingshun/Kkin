import { DEFAULT_ELDERLY_ID, DEFAULT_FAMILY_ID } from '@/config/runtime';
import { getUploadMediaUrl, getUploadThumbnailUrl } from '@/utils/media';
import { buildQueryString, request } from '@/utils/request';

export type MoodType = 'happy' | 'calm' | 'sad' | 'anxious' | 'angry' | 'tired';

export interface ElderlyMessage {
  id: number;
  family_id: string;
  content: string;
  sender_name: string;
  sender_relation: string;
  scheduled_time: string;
  played: boolean;
  liked: boolean;
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
  status?: 'pending' | 'completed' | 'skipped' | 'missed';
}

export interface FamilyUser {
  id: number;
  user_type: 'family' | 'elderly' | string;
  name: string;
  phone?: string;
  family_id: string;
  created_at?: string;
}

export interface RecommendedMedia {
  id: number;
  family_id: string;
  media_type: 'photo' | 'video';
  title: string;
  description?: string;
  file_path: string;
  thumbnail_path?: string;
  tags: string[];
  moods: string[];
  occasions: string[];
  cooldown?: number;
  priority?: number;
  play_count: number;
  last_played_at?: string;
  created_at?: string;
}

export interface MoodRecord {
  id?: number;
  family_id: string;
  elderly_id?: number;
  mood_type: MoodType;
  mood_score: number;
  note?: string;
  recorded_at?: string;
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

export interface AiInteraction {
  id: number;
  username: string;
  type: 'member' | 'ai' | string;
  way?: string;
  content: string;
  createtime?: number;
  timetext?: string;
}

export interface MediaHistoryEntry {
  id: number;
  media_id: number;
  elderly_id: number;
  played_at: string;
  duration_watched: number;
  completed: number;
  triggered_by: string;
  mood_before?: string;
  mood_after?: string;
  title: string;
  media_type: 'photo' | 'video';
  file_path: string;
  thumbnail_path?: string;
  feedback_type?: 'like' | 'dislike' | null;
}

export const moodLabelMap: Record<MoodType, string> = {
  happy: '开心',
  calm: '平静',
  sad: '难过',
  anxious: '焦虑',
  angry: '生气',
  tired: '疲惫',
};

export const moodEmojiMap: Record<MoodType, string> = {
  happy: '开心',
  calm: '平静',
  sad: '难过',
  anxious: '焦虑',
  angry: '生气',
  tired: '疲惫',
};

export function getMediaUrl(filePath: string) {
  return getUploadMediaUrl(filePath);
}

export function getThumbnailUrl(thumbnailPath: string) {
  return getUploadThumbnailUrl(thumbnailPath);
}

export async function sendSOSAlert(familyId = DEFAULT_FAMILY_ID, elderlyId = DEFAULT_ELDERLY_ID) {
  const now = new Date();
  const data = await request<{ success?: boolean }>('/elderly/alerts', {
    method: 'POST',
    data: {
      family_id: familyId,
      elderly_id: elderlyId,
      alert_type: 'sos_emergency',
      level: 'high',
      title: '紧急求助',
      message: `老人发起了紧急求助（${now.toLocaleDateString('zh-CN')} ${now.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })}）`,
    },
  });

  return data.success !== false;
}

export async function sendContactFamilyAlert(
  familyId = DEFAULT_FAMILY_ID,
  elderlyId = DEFAULT_ELDERLY_ID
) {
  const now = new Date();
  const data = await request<{ success?: boolean }>('/elderly/alerts', {
    method: 'POST',
    data: {
      family_id: familyId,
      elderly_id: elderlyId,
      alert_type: 'contact_family',
      level: 'medium',
      message: `老人希望家人联系自己（${now.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })}）`,
    },
  });

  return data.success !== false;
}

export async function getTodaySchedules(familyId = DEFAULT_FAMILY_ID) {
  const data = await request<{ schedules: Schedule[] }>(`/elderly/schedules/today?family_id=${familyId}`);
  return data.schedules || [];
}

export async function getScheduleHistory(familyId = DEFAULT_FAMILY_ID, limit = 50) {
  const params = buildQueryString({ family_id: familyId, limit });
  const data = await request<{ schedules: Schedule[] }>(`/elderly/schedules/history?${params}`);
  return data.schedules || [];
}

export async function updateScheduleStatus(scheduleId: number, status: NonNullable<Schedule['status']>) {
  const data = await request<{ success: boolean }>(`/elderly/schedules/${scheduleId}/status`, {
    method: 'POST',
    data: { status },
  });
  return data.success;
}

export async function getFamilyUsers(familyId = DEFAULT_FAMILY_ID) {
  const data = await request<{ users: FamilyUser[] }>(`/users/${familyId}`);
  return data.users || [];
}

export async function getElderlyMessages(familyId = DEFAULT_FAMILY_ID) {
  const data = await request<{ messages: ElderlyMessage[] }>(`/elderly/messages?family_id=${familyId}`);
  return data.messages || [];
}

export async function getPendingMessages(familyId = DEFAULT_FAMILY_ID) {
  const data = await request<{ messages: ElderlyMessage[] }>(
    `/elderly/messages/pending?family_id=${familyId}`
  );
  return data.messages || [];
}

export async function markAsPlayed(messageId: number) {
  const data = await request<{ success: boolean }>(`/elderly/messages/${messageId}/play`, {
    method: 'POST',
  });
  return data.success;
}

export async function likeMessage(messageId: number) {
  const data = await request<{ success: boolean }>(`/elderly/messages/${messageId}/like`, {
    method: 'POST',
  });
  return data.success;
}

export async function unlikeMessage(messageId: number) {
  const data = await request<{ success: boolean }>(`/elderly/messages/${messageId}/unlike`, {
    method: 'POST',
  });
  return data.success;
}

export async function getRecommendedMedia(
  familyId = DEFAULT_FAMILY_ID,
  elderlyId: number | undefined = DEFAULT_ELDERLY_ID,
  mood?: MoodType
) {
  const params = buildQueryString({
    family_id: familyId,
    elderly_id: String(elderlyId || DEFAULT_ELDERLY_ID),
    mood,
  });

  const data = await request<{ media: RecommendedMedia[] }>(`/elderly/media/recommended?${params}`);
  return data.media || [];
}

export async function recordMediaPlay(mediaId: number, elderlyId = DEFAULT_ELDERLY_ID) {
  await request(`/elderly/media/${mediaId}/play`, {
    method: 'POST',
    data: {
      elderly_id: elderlyId,
      triggered_by: 'manual',
      completed: 1,
    },
  });
}

export async function submitMediaFeedback(
  mediaId: number,
  feedbackType: 'like' | 'dislike',
  elderlyId = DEFAULT_ELDERLY_ID
) {
  await request(`/elderly/media/${mediaId}/feedback`, {
    method: 'POST',
    data: {
      elderly_id: elderlyId,
      feedback_type: feedbackType,
    },
  });
}

export async function getMediaHistory(elderlyId = DEFAULT_ELDERLY_ID, limit = 20) {
  const params = buildQueryString({
    elderly_id: String(elderlyId),
    limit: String(limit),
  });

  const data = await request<{ history: MediaHistoryEntry[] }>(`/elderly/media/history?${params}`);
  return data.history || [];
}

export async function createMoodRecord(
  familyId = DEFAULT_FAMILY_ID,
  moodType: MoodType,
  elderlyId = DEFAULT_ELDERLY_ID,
  options: {
    moodScore?: number;
    note?: string;
    triggerEvent?: string;
    location?: string;
    weather?: string;
  } = {}
) {
  const moodScoreMap: Record<MoodType, number> = {
    happy: 9,
    calm: 7,
    sad: 3,
    anxious: 4,
    angry: 2,
    tired: 5,
  };

  const data = await request<{ record_id: number }>('/elderly/moods', {
    method: 'POST',
    data: {
      family_id: familyId,
      elderly_id: elderlyId,
      mood_type: moodType,
      mood_score: options.moodScore ?? moodScoreMap[moodType],
      note: options.note || '',
      trigger_event: options.triggerEvent || '',
      location: options.location || '',
      weather: options.weather || '',
      source: 'manual',
    },
  });

  return data.record_id;
}

export async function getMoodRecords(
  familyId = DEFAULT_FAMILY_ID,
  elderlyId = DEFAULT_ELDERLY_ID,
  limit = 20
) {
  const params = buildQueryString({
    family_id: familyId,
    elderly_id: String(elderlyId),
    limit: String(limit),
  });

  const data = await request<{ records: MoodRecord[]; total: number }>(`/elderly/moods?${params}`);
  return data.records || [];
}

export async function getLatestMood(
  familyId = DEFAULT_FAMILY_ID,
  elderlyId = DEFAULT_ELDERLY_ID
) {
  const data = await request<{ record: MoodRecord | null }>(
    `/elderly/moods/latest?family_id=${familyId}&elderly_id=${elderlyId}`
  );
  return data.record;
}

export async function getCounselors() {
  const data = await request<{ counselors: Counselor[] }>('/counselors');
  return data.counselors || [];
}

export async function getConsultations(
  familyId = DEFAULT_FAMILY_ID,
  elderlyId?: number,
  limit = 20
) {
  const params = buildQueryString({
    family_id: familyId,
    elderly_id: elderlyId,
    limit: String(limit),
  });

  const data = await request<{ consultations: Consultation[] }>(`/consultations?${params}`);
  return data.consultations || [];
}

export async function createConsultation(payload: {
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
      elderly_id: payload.elderly_id ?? DEFAULT_ELDERLY_ID,
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

export async function updateConsultation(
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

export async function getAiInteractions(limit = 30) {
  const params = buildQueryString({
    username: 'User',
    limit: String(limit),
  });

  const data = await request<{ list: AiInteraction[] }>(`/family/interactions?${params}`);
  return data.list || [];
}
