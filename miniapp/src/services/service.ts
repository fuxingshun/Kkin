import { DEFAULT_FAMILY_ID } from '@/config/runtime';
import {
  createConsultation,
  getConsultations,
  getFamilyUsers,
  type Consultation,
  type FamilyUser,
  updateConsultation,
} from '@/services/elderly';
import {
  alertTypeLabelMap,
  getFamilyAlerts,
  getFamilyMoods,
  handleAlert,
  markAlertAsRead,
  queryFamilyMoodRecords,
  type FamilyAlert,
  type MoodRecord,
} from '@/services/family';
import { formatDateTimeValue } from '@/utils/format';

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

function getTaskStatus(alert: FamilyAlert): ServiceTask['status'] {
  if (alert.handled) {
    return 'completed';
  }

  if (alert.read) {
    return 'processing';
  }

  return 'pending';
}

function getPriority(level?: FamilyAlert['level']): ServiceTask['priority'] {
  if (level === 'high') return 'high';
  if (level === 'medium') return 'medium';
  return 'low';
}

function getRiskScore(mood?: MoodRecord, openAlertCount = 0, alerts: FamilyAlert[] = []) {
  const highestLevel = alerts.find((item) => !item.handled && item.level === 'high')
    ? 'high'
    : alerts.find((item) => !item.handled && item.level === 'medium')
      ? 'medium'
      : 'low';

  if (highestLevel === 'high' || openAlertCount >= 2 || (mood?.mood_score ?? 10) <= 4) {
    return 'high' as const;
  }

  if (highestLevel === 'medium' || openAlertCount >= 1 || (mood?.mood_score ?? 10) <= 6) {
    return 'medium' as const;
  }

  return 'low' as const;
}

function riskRank(risk: ServiceCase['risk']) {
  if (risk === 'high') return 3;
  if (risk === 'medium') return 2;
  return 1;
}

function getMoodLabel(record?: MoodRecord) {
  if (!record) return '暂无记录';
  return `${record.mood_type} ${record.mood_score ?? '--'}分`;
}

function mapConsultationType(type: Consultation['consultation_type']) {
  if (type === 'phone') return '电话随访';
  if (type === 'video') return '视频随访';
  if (type === 'text') return '文字记录';
  return '服务记录';
}

export async function getServiceTasks(familyId = DEFAULT_FAMILY_ID, limit = 50) {
  const { alerts } = await getFamilyAlerts(familyId, { limit });

  return alerts.map<ServiceTask>((alert) => ({
    id: alert.id,
    alertId: alert.id,
    elderlyId: alert.elderly_id,
    elderlyName: alert.elderly_name || `老人${alert.elderly_id ?? ''}` || '未绑定老人',
    typeLabel: alert.title || alertTypeLabelMap[alert.alert_type] || '服务工单',
    reason: alert.message,
    priority: getPriority(alert.level),
    status: getTaskStatus(alert),
    createdAt: alert.created_at,
  }));
}

export async function startServiceTask(alertId: number) {
  return markAlertAsRead(alertId);
}

export async function completeServiceTask(alertId: number, replyMessage = '已完成本次跟进处理') {
  return handleAlert(alertId, { reply_message: replyMessage });
}

export async function getServiceCases(familyId = DEFAULT_FAMILY_ID) {
  const [users, { alerts }, moods] = await Promise.all([
    getFamilyUsers(familyId),
    getFamilyAlerts(familyId, { limit: 100 }),
    getFamilyMoods(familyId, 100),
  ]);

  const familyContacts = users.filter((item) => item.user_type === 'family');
  const primaryContact = familyContacts[0];

  return users
    .filter((item) => item.user_type === 'elderly')
    .map<ServiceCase>((elder) => {
      const elderAlerts = alerts.filter((item) => item.elderly_id === elder.id);
      const openAlertCount = elderAlerts.filter((item) => !item.handled).length;
      const latestMood = moods.find((item) => item.elderly_id === elder.id);
      const latestAlert = elderAlerts[0];
      const risk = getRiskScore(latestMood, openAlertCount, elderAlerts);

      return {
        elderlyId: elder.id,
        name: elder.name,
        phone: elder.phone,
        familyContactName: primaryContact?.name,
        familyContactPhone: primaryContact?.phone,
        risk,
        lastEmotion: getMoodLabel(latestMood),
        lastEmotionScore: latestMood?.mood_score,
        lastHelpAt: latestAlert?.created_at,
        openAlertCount,
        latestAlertId: latestAlert?.id,
      };
    })
    .sort((left, right) => {
      const riskDiff = riskRank(right.risk) - riskRank(left.risk);
      if (riskDiff !== 0) {
        return riskDiff;
      }

      return (right.openAlertCount || 0) - (left.openAlertCount || 0);
    });
}

export async function getServiceCaseDetail(familyId = DEFAULT_FAMILY_ID, elderlyId: number) {
  const [cases, alertsResult, moods, consultations, users] = await Promise.all([
    getServiceCases(familyId),
    getFamilyAlerts(familyId, { elderlyId, limit: 20 }),
    queryFamilyMoodRecords(familyId, { elderlyId, limit: 14 }),
    getConsultations(familyId, elderlyId, 20),
    getFamilyUsers(familyId),
  ]);

  const detailCase = cases.find((item) => item.elderlyId === elderlyId);
  const familyContacts = users.filter((item) => item.user_type === 'family');

  return {
    caseInfo: detailCase,
    alerts: alertsResult.alerts,
    moodRecords: moods,
    moodTrend: moods.slice(0, 7).reverse().map((item, index) => ({
      day: item.recorded_at?.slice(5, 10) || item.created_at?.slice(5, 10) || `${index + 1}`,
      score: item.mood_score || 0,
    })),
    consultations,
    familyContacts,
  };
}

export async function getServiceFollowups(familyId = DEFAULT_FAMILY_ID, limit = 30) {
  const consultations = await getConsultations(familyId, undefined, limit);
  const users = await getFamilyUsers(familyId);
  const elderlyMap = new Map(
    users.filter((item) => item.user_type === 'elderly').map((item) => [item.id, item.name])
  );

  return consultations
    .map<ServiceFollowup>((item) => ({
      id: item.id,
      elderlyId: item.elderly_id,
      elderlyName: item.elderly_id ? elderlyMap.get(item.elderly_id) || `老人${item.elderly_id}` : '未绑定老人',
      consultationType: mapConsultationType(item.consultation_type),
      scheduledTime: item.scheduled_time,
      status: item.status,
      note: item.note,
    }))
    .sort((left, right) => left.scheduledTime.localeCompare(right.scheduledTime));
}

export async function advanceFollowupStatus(consultation: ServiceFollowup) {
  if (consultation.status === 'scheduled') {
    return updateConsultation(consultation.id, { status: 'in_progress' });
  }

  if (consultation.status === 'in_progress') {
    return updateConsultation(consultation.id, { status: 'completed' });
  }

  return true;
}

export async function createQuickFollowup(
  elderlyId: number,
  familyId = DEFAULT_FAMILY_ID,
  consultationType: Consultation['consultation_type'] = 'phone',
  note = '服务端新建随访任务'
) {
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
  return createConsultation({
    family_id: familyId,
    elderly_id: elderlyId,
    consultation_type: consultationType,
    scheduled_time: formatDateTimeValue(scheduledAt),
    duration: 30,
    note,
    status: 'scheduled',
  });
}

export async function createServiceRecord(payload: {
  familyId?: string;
  elderlyId: number;
  alertId?: number;
  content: string;
}) {
  const familyId = payload.familyId || DEFAULT_FAMILY_ID;
  const now = new Date();
  const consultationId = await createConsultation({
    family_id: familyId,
    elderly_id: payload.elderlyId,
    consultation_type: 'text',
    scheduled_time: formatDateTimeValue(now),
    duration: 15,
    note: payload.content,
    status: 'completed',
  });

  if (payload.alertId) {
    await handleAlert(payload.alertId, { reply_message: payload.content });
  }

  return consultationId;
}
