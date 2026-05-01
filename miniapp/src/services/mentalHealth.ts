import { DEFAULT_ELDERLY_ID, DEFAULT_FAMILY_ID } from '@/config/runtime';
import { getFamilySession } from '@/utils/familySession';
import { getMiniappAssetOrigin } from '@/utils/media';
import { buildQueryString, request, uploadFile } from '@/utils/request';
import { getServiceSession } from '@/utils/serviceSession';
import { getElderlySession } from '@/utils/session';

export type MentalRiskLevel = 'low' | 'medium' | 'high' | 'review' | string;

export interface MentalScreening {
  id: number;
  family_id: string;
  elderly_id?: number;
  elderly_name?: string;
  capture_mode: 'live_camera' | string;
  risk_level: MentalRiskLevel;
  risk_score: number;
  status_label: string;
  summary: string;
  recommendation: string;
  frame_path?: string;
  frame_count: number;
  completed_actions: number;
  liveness_score: number;
  quality_score: number;
  source: string;
  created_at: string;
}

export interface LiveScreeningResult extends MentalScreening {
  alert_id?: number;
  disclaimer: string;
}

export interface PsychologyVideo {
  id: number;
  slug: string;
  title: string;
  category?: string;
  duration?: string;
  speaker?: string;
  summary?: string;
  poster_url?: string;
  source_url: string;
  license?: string;
  cover_class_name?: string;
  takeaways: string[];
  sort_order?: number;
}

export interface PsychologyCategory {
  id: number;
  name: string;
  icon?: string;
  class_name?: string;
  sort_order?: number;
}

export interface PsychologyQuestion {
  id: number;
  question: string;
  reply_count?: number;
  sort_order?: number;
}

export interface PsychologyResources {
  videos: PsychologyVideo[];
  categories: PsychologyCategory[];
  questions: PsychologyQuestion[];
}

export interface PsychologyQuestionReply {
  id: number;
  question_id: number;
  reply_type: 'answer' | 'comment' | string;
  author_name: string;
  author_role?: string;
  content: string;
  like_count?: number;
  sort_order?: number;
  created_at?: string;
}

export interface PsychologyQuestionDetail {
  question: PsychologyQuestion;
  replies: PsychologyQuestionReply[];
}

function resolveFamilyId(familyId?: string) {
  if (familyId && familyId.trim()) {
    return familyId.trim();
  }

  const familySession = getFamilySession();
  if (familySession.familyId && familySession.familyId !== DEFAULT_FAMILY_ID) {
    return familySession.familyId;
  }

  const serviceSession = getServiceSession();
  if (serviceSession.familyId && serviceSession.familyId !== DEFAULT_FAMILY_ID) {
    return serviceSession.familyId;
  }

  const elderlySession = getElderlySession();
  if (elderlySession.familyId) {
    return elderlySession.familyId;
  }

  return DEFAULT_FAMILY_ID;
}

function resolveElderlyId(elderlyId?: number) {
  if (typeof elderlyId === 'number' && Number.isFinite(elderlyId) && elderlyId > 0) {
    return elderlyId;
  }

  return getElderlySession().elderlyId || DEFAULT_ELDERLY_ID;
}

export async function submitLiveMentalScreening(payload: {
  filePath: string;
  familyId?: string;
  elderlyId?: number;
  frameCount: number;
  completedActions: number;
  livenessScore: number;
  qualityScore: number;
}) {
  return uploadFile<LiveScreeningResult>('/elderly/mental-screenings/live', {
    filePath: payload.filePath,
    name: 'frame',
    timeout: 12000,
    formData: {
      family_id: resolveFamilyId(payload.familyId),
      elderly_id: resolveElderlyId(payload.elderlyId),
      frame_count: payload.frameCount,
      completed_actions: payload.completedActions,
      liveness_score: payload.livenessScore,
      quality_score: payload.qualityScore,
      consent_version: 'mental-screening-live-v1',
    },
  });
}

export async function getLatestMentalScreening(familyId?: string, elderlyId?: number) {
  const query = buildQueryString({
    family_id: resolveFamilyId(familyId),
    elderly_id: elderlyId,
  });
  const data = await request<{ record: MentalScreening | null }>(`/mental-screenings/latest?${query}`);
  return data.record;
}

export async function getMentalScreenings(familyId?: string, elderlyId?: number, limit = 10) {
  const query = buildQueryString({
    family_id: resolveFamilyId(familyId),
    elderly_id: elderlyId,
    limit,
  });
  const data = await request<{ records: MentalScreening[] }>(`/mental-screenings?${query}`);
  return data.records || [];
}

export function getPsychologyVideoUrl(slug: string) {
  return `${getMiniappAssetOrigin()}/psychology-videos/${encodeURIComponent(slug)}.mp4`;
}

export async function getPsychologyResources() {
  const data = await request<PsychologyResources>('/psychology/resources');
  return {
    videos: data.videos || [],
    categories: data.categories || [],
    questions: data.questions || [],
  };
}

export async function getPsychologyQuestionDetail(questionId: number) {
  const data = await request<PsychologyQuestionDetail>(`/psychology/questions/${questionId}`);
  return {
    question: data.question,
    replies: data.replies || [],
  };
}
