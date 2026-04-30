import { DEFAULT_FAMILY_ID } from '@/config/runtime';
import { type Consultation, type FamilyUser, type MoodRecord } from '@/services/elderly';
import { type CareInsight, type FamilyAlert } from '@/services/family';
import { formatDateTimeValue } from '@/utils/format';
import { buildQueryString, request } from '@/utils/request';
import { getCurrentServiceFamilyId } from '@/utils/serviceSession';

export interface ServiceTask {
  id: number;
  alertId: number;
  elderlyId?: number;
  elderlyName: string;
  typeLabel: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'processing' | 'completed';
  createdAt: string;
}

export interface ServiceCase {
  elderlyId: number;
  name: string;
  phone?: string;
  familyContactName?: string;
  familyContactPhone?: string;
  risk: 'high' | 'medium' | 'low';
  lastEmotion: string;
  lastEmotionScore?: number;
  lastHelpAt?: string;
  openAlertCount: number;
  latestAlertId?: number;
}

export interface ServiceFollowup {
  id: number;
  elderlyId?: number;
  elderlyName: string;
  consultationType: string;
  scheduledTime: string;
  status: Consultation['status'];
  note?: string;
}

export interface ServiceOverview {
  family_id: string;
  task_stats: {
    pending: number;
    processing: number;
    completed: number;
    total: number;
  };
  case_stats: {
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  followup_stats: {
    scheduled: number;
    in_progress: number;
    completed: number;
    active: number;
    total: number;
  };
}

interface ServiceTaskApi {
  id: number;
  alert_id: number;
  elderly_id?: number;
  elderly_name?: string;
  type_label?: string;
  reason: string;
  priority: ServiceTask['priority'] | string;
  status: ServiceTask['status'] | string;
  created_at: string;
}

interface ServiceCaseApi {
  elderly_id: number;
  name: string;
  phone?: string;
  family_contact_name?: string;
  family_contact_phone?: string;
  risk: ServiceCase['risk'] | string;
  last_emotion: string;
  last_emotion_score?: number;
  last_help_at?: string;
  open_alert_count: number;
  latest_alert_id?: number;
}

interface ServiceCaseDetailApi {
  family_id: string;
  case_info: ServiceCaseApi | null;
  alerts: FamilyAlert[];
  mood_records: MoodRecord[];
  mood_trend: Array<{ day: string; score: number }>;
  consultations: Consultation[];
  family_contacts: FamilyUser[];
  insight?: CareInsight;
}

interface ServiceFollowupApi {
  id: number;
  elderly_id?: number;
  elderly_name?: string;
  consultation_type: Consultation['consultation_type'];
  scheduled_time: string;
  status: Consultation['status'];
  note?: string;
}

function resolveFamilyId(familyId?: string) {
  if (!familyId || familyId === DEFAULT_FAMILY_ID) {
    return getCurrentServiceFamilyId();
  }
  return getCurrentServiceFamilyId(familyId);
}

function normalizeRisk(value?: string): ServiceCase['risk'] {
  if (value === 'high') return 'high';
  if (value === 'medium') return 'medium';
  return 'low';
}

function normalizePriority(value?: string): ServiceTask['priority'] {
  if (value === 'high') return 'high';
  if (value === 'medium') return 'medium';
  return 'low';
}

function normalizeTaskStatus(value?: string): ServiceTask['status'] {
  if (value === 'processing') return 'processing';
  if (value === 'completed') return 'completed';
  return 'pending';
}

function mapConsultationType(type: Consultation['consultation_type']) {
  if (type === 'phone') return '电话随访';
  if (type === 'video') return '视频随访';
  if (type === 'text') return '服务记录';
  return '服务记录';
}

function toServiceTask(item: ServiceTaskApi): ServiceTask {
  return {
    id: Number(item.id || item.alert_id || 0),
    alertId: Number(item.alert_id || item.id || 0),
    elderlyId: item.elderly_id,
    elderlyName: item.elderly_name || (item.elderly_id ? `老人${item.elderly_id}` : '未绑定老人'),
    typeLabel: item.type_label || '服务工单',
    reason: item.reason || '',
    priority: normalizePriority(item.priority),
    status: normalizeTaskStatus(item.status),
    createdAt: item.created_at,
  };
}

function toServiceCase(item: ServiceCaseApi): ServiceCase {
  return {
    elderlyId: item.elderly_id,
    name: item.name,
    phone: item.phone,
    familyContactName: item.family_contact_name,
    familyContactPhone: item.family_contact_phone,
    risk: normalizeRisk(item.risk),
    lastEmotion: item.last_emotion || '暂无记录',
    lastEmotionScore: item.last_emotion_score,
    lastHelpAt: item.last_help_at,
    openAlertCount: Number(item.open_alert_count || 0),
    latestAlertId: item.latest_alert_id,
  };
}

function toServiceFollowup(item: ServiceFollowupApi): ServiceFollowup {
  return {
    id: Number(item.id || 0),
    elderlyId: item.elderly_id,
    elderlyName: item.elderly_name || (item.elderly_id ? `老人${item.elderly_id}` : '未绑定老人'),
    consultationType: mapConsultationType(item.consultation_type),
    scheduledTime: item.scheduled_time,
    status: item.status,
    note: item.note,
  };
}

export async function getServiceOverview(familyId = DEFAULT_FAMILY_ID) {
  return request<ServiceOverview>(`/service/overview?family_id=${encodeURIComponent(resolveFamilyId(familyId))}`);
}

export async function getServiceTasks(familyId = DEFAULT_FAMILY_ID, limit = 50) {
  const query = buildQueryString({ family_id: resolveFamilyId(familyId), limit });
  const data = await request<{ tasks: ServiceTaskApi[] }>(`/service/tasks?${query}`);
  return (data.tasks || []).map(toServiceTask);
}

export async function startServiceTask(alertId: number) {
  await request<{ success: boolean }>(`/service/tasks/${alertId}/start`, {
    method: 'POST',
    data: {},
  });
  return true;
}

export async function completeServiceTask(alertId: number, replyMessage = '服务端已完成处理') {
  await request<{ success: boolean }>(`/service/tasks/${alertId}/complete`, {
    method: 'POST',
    data: { reply_message: replyMessage },
  });
  return true;
}

export async function getServiceCases(familyId = DEFAULT_FAMILY_ID) {
  const query = buildQueryString({ family_id: resolveFamilyId(familyId) });
  const data = await request<{ cases: ServiceCaseApi[] }>(`/service/cases?${query}`);
  return (data.cases || []).map(toServiceCase);
}

export async function getServiceCaseDetail(familyId = DEFAULT_FAMILY_ID, elderlyId: number) {
  const query = buildQueryString({ family_id: resolveFamilyId(familyId) });
  const data = await request<ServiceCaseDetailApi>(`/service/cases/${elderlyId}?${query}`);

  return {
    caseInfo: data.case_info ? toServiceCase(data.case_info) : null,
    alerts: data.alerts || [],
    moodRecords: data.mood_records || [],
    moodTrend: data.mood_trend || [],
    consultations: data.consultations || [],
    familyContacts: data.family_contacts || [],
    insight: data.insight || null,
  };
}

export async function getServiceFollowups(familyId = DEFAULT_FAMILY_ID, limit = 30) {
  const query = buildQueryString({ family_id: resolveFamilyId(familyId), limit });
  const data = await request<{ followups: ServiceFollowupApi[] }>(`/service/followups?${query}`);
  return (data.followups || []).map(toServiceFollowup);
}

export async function advanceFollowupStatus(consultation: ServiceFollowup) {
  if (consultation.status === 'completed') {
    return true;
  }

  const nextStatus = consultation.status === 'scheduled' ? 'in_progress' : 'completed';
  const data = await request<{ success: boolean }>(`/service/followups/${consultation.id}/status`, {
    method: 'PUT',
    data: {
      family_id: resolveFamilyId(),
      status: nextStatus,
    },
  });
  return data.success;
}

export async function createQuickFollowup(
  elderlyId: number,
  familyId = DEFAULT_FAMILY_ID,
  consultationType: 'phone' | 'video' | 'text' = 'phone',
  note = '服务端新建随访任务'
) {
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
  const data = await request<{ consultation_id: number }>('/service/followups', {
    method: 'POST',
    data: {
      family_id: resolveFamilyId(familyId),
      elderly_id: elderlyId,
      consultation_type: consultationType,
      scheduled_time: formatDateTimeValue(scheduledAt),
      duration: 30,
      note,
      status: 'scheduled',
    },
  });
  return data.consultation_id;
}

export async function createServiceRecord(payload: {
  familyId?: string;
  elderlyId: number;
  alertId?: number;
  content: string;
}) {
  const data = await request<{ consultation_id: number }>('/service/records', {
    method: 'POST',
    data: {
      family_id: resolveFamilyId(payload.familyId || DEFAULT_FAMILY_ID),
      elderly_id: payload.elderlyId,
      alert_id: payload.alertId,
      content: payload.content,
    },
  });
  return data.consultation_id;
}
