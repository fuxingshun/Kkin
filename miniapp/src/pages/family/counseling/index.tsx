import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';
import {
  createFamilyConsultation,
  getCounselors,
  getFamilyConsultations,
  getFamilyUsers,
  updateFamilyConsultation,
  type Consultation,
  type Counselor,
  type FamilyUser,
} from '@/services/family';
import { formatDateTimeText, formatDateTimeValue } from '@/utils/format';
import { getFamilySession, requireCurrentFamilyId } from '@/utils/familySession';

const methods = [
  { type: 'phone' as const, label: '电话咨询', desc: '适合快速沟通照护问题', tone: 'green' },
  { type: 'video' as const, label: '视频咨询', desc: '适合一起梳理陪伴和情绪波动', tone: 'blue' },
  { type: 'text' as const, label: '文字咨询', desc: '适合先把问题整理清楚', tone: 'pink' },
] as const;

function getStatusLabel(status: Consultation['status']) {
  if (status === 'scheduled') return { label: '已预约', tone: 'pink' };
  if (status === 'in_progress') return { label: '进行中', tone: 'blue' };
  if (status === 'completed') return { label: '已完成', tone: 'green' };
  if (status === 'cancelled') return { label: '已取消', tone: 'amber' };
  return { label: status, tone: 'amber' };
}

function getTypeLabel(type: Consultation['consultation_type']) {
  if (type === 'phone') return '电话咨询';
  if (type === 'video') return '视频咨询';
  if (type === 'text') return '文字咨询';
  return '心理咨询';
}

function buildQuickSlots() {
  const now = new Date();
  const slots: Date[] = [];

  const first = new Date(now);
  first.setMinutes(first.getMinutes() < 30 ? 30 : 0, 0, 0);
  if (first <= now) {
    first.setHours(first.getHours() + 1);
  }
  slots.push(first);

  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(10, 30, 0, 0);
  slots.push(tomorrowMorning);

  const tomorrowEvening = new Date(now);
  tomorrowEvening.setDate(tomorrowEvening.getDate() + 1);
  tomorrowEvening.setHours(19, 0, 0, 0);
  slots.push(tomorrowEvening);

  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(15, 0, 0, 0);
  slots.push(dayAfter);

  return slots;
}

function formatSlotLabel(value: Date) {
  return value.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNextActionLabel(item?: Consultation | null) {
  if (!item) return '创建预约';
  if (item.next_action) return item.next_action;
  if (item.status === 'scheduled') return '进入咨询';
  if (item.status === 'in_progress') return '完成咨询';
  return '查看记录';
}

function getStatusText(item: Consultation) {
  return item.status_label || getStatusLabel(item.status).label;
}

function getConsultationSummary(item: Consultation, elderName?: string) {
  if (item.family_visible_summary) return item.family_visible_summary;
  return `咨询师：${item.counselor_name || '待分配'}${elderName ? ` · 服务对象：${elderName}` : ''}`;
}

export default function CounselingPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<(typeof methods)[number]['type']>('phone');
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const familySession = useMemo(() => getFamilySession(), []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nextCounselors, nextConsultations, nextUsers] = await Promise.all([
        getCounselors(),
        getFamilyConsultations(undefined, 50),
        getFamilyUsers(),
      ]);
      setCounselors(nextCounselors);
      setConsultations(nextConsultations);
      setUsers(nextUsers);
    } catch (error) {
      const message = error instanceof Error ? error.message : '咨询数据加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  usePullDownRefresh(() => {
    void loadData();
  });

  const quickSlots = useMemo(() => buildQuickSlots(), []);
  const elderUser = useMemo(() => users.find((item) => item.user_type === 'elderly') ?? null, [users]);
  const availableCounselor = useMemo(() => counselors.find((item) => item.available) || counselors[0] || null, [counselors]);
  const upcomingConsultation = useMemo(
    () =>
      consultations
        .filter((item) => item.status !== 'completed' && item.status !== 'cancelled')
        .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())[0] || null,
    [consultations]
  );
  const historyConsultations = useMemo(
    () =>
      consultations
        .filter((item) => item.status === 'completed' || item.status === 'cancelled')
        .sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime()),
    [consultations]
  );

  async function createReservation(slot: Date, counselor?: Counselor | null) {
    const targetCounselor = counselor || availableCounselor;

    if (!targetCounselor) {
      Taro.showToast({ title: '当前暂无可预约咨询师', icon: 'none' });
      return;
    }

    try {
      setSubmitting(true);
      const familyId = requireCurrentFamilyId(familySession);
      await createFamilyConsultation({
        family_id: familyId,
        elderly_id: elderUser?.id,
        counselor_id: targetCounselor.id,
        consultation_type: selectedType,
        scheduled_time: formatDateTimeValue(slot),
        note: `家属端预约 ${getTypeLabel(selectedType)}`,
      });
      Taro.showToast({ title: '预约已提交', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '预约失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }

  async function advanceUpcoming() {
    if (!upcomingConsultation) {
      await createReservation(quickSlots[0], availableCounselor);
      return;
    }

    try {
      setSubmitting(true);
      const nextStatus =
        upcomingConsultation.status === 'scheduled'
          ? 'in_progress'
          : upcomingConsultation.status === 'in_progress'
            ? 'completed'
            : upcomingConsultation.status;

      await updateFamilyConsultation(upcomingConsultation.id, {
        status: nextStatus,
        note:
          upcomingConsultation.note ||
          (nextStatus === 'in_progress' ? '家属端已进入咨询' : '家属端已完成咨询'),
      });
      Taro.showToast({
        title: nextStatus === 'in_progress' ? '已进入咨询' : '咨询已完成',
        icon: 'success',
      });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '咨询状态更新失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-sub-topbar'>
        <Text className='ff-back' onClick={() => Taro.redirectTo({ url: '/pages/family/dashboard/index' })}>‹</Text>
        <Text className='ff-sub-topbar__title'>预约咨询</Text>
        <Text className='ff-sub-topbar__spacer'> </Text>
      </View>

      <View className='ff-stack ff-stack--page'>
        <View className='ff-counsel-hero'>
          <View>
            <Text className='ff-kicker'>家属支持</Text>
            <Text className='ff-hero__title'>把照护压力说出来</Text>
            <Text className='ff-hero__subtitle'>
              直接查看咨询师、预约记录和当前咨询安排，和老人端保持同一条业务线。
            </Text>
          </View>
          <View className='ff-avatar ff-avatar--glass'>询</View>
        </View>

        <View className='ff-card'>
          <View className='ff-section-head'>
            <View>
              <Text className='ff-section-title'>即将开始</Text>
              <Text className='ff-card-subtitle'>
                {upcomingConsultation
                  ? `${formatDateTimeText(upcomingConsultation.scheduled_time)} · ${getTypeLabel(upcomingConsultation.consultation_type)}`
                  : '当前还没有待开始的咨询'}
              </Text>
            </View>
            {upcomingConsultation ? (
              <Text className={`ff-chip ff-chip--${getStatusLabel(upcomingConsultation.status).tone}`}>
                {getStatusText(upcomingConsultation)}
              </Text>
            ) : null}
          </View>
          <Text className='ff-card-text'>
            {upcomingConsultation
              ? getConsultationSummary(upcomingConsultation, elderUser?.name)
              : '点击下方按钮后，会用当前选择的咨询方式为家庭创建一条真实预约记录。'}
          </Text>
          {upcomingConsultation?.can_reschedule || upcomingConsultation?.can_cancel ? (
            <Text className='ff-card-subtitle'>
              {upcomingConsultation.can_reschedule ? '支持改约' : ''}
              {upcomingConsultation.can_reschedule && upcomingConsultation.can_cancel ? ' · ' : ''}
              {upcomingConsultation.can_cancel ? '支持取消' : ''}
            </Text>
          ) : null}
          <Button className='ff-download-button ff-download-button--pink' loading={submitting} onClick={() => void advanceUpcoming()}>
            {getNextActionLabel(upcomingConsultation)}
          </Button>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>咨询方式</Text>
          <View className='ff-action-grid'>
            {methods.map((item) => (
              <View
                key={item.type}
                className={`ff-action ff-action--${item.tone}`}
                onClick={() => setSelectedType(item.type)}
              >
                <Text className='ff-action__icon'>{selectedType === item.type ? '选' : '询'}</Text>
                <Text>{item.label}</Text>
                <Text>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>快速预约</Text>
          <View className='ff-reserve-grid'>
            {quickSlots.map((slot) => (
              <Text key={slot.toISOString()} onClick={() => void createReservation(slot)}>
                {formatSlotLabel(slot)}
              </Text>
            ))}
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>推荐咨询师</Text>
          <View className='ff-list'>
            {counselors.length ? (
              counselors.map((item) => (
                <View className='ff-counselor-row' key={item.id}>
                  <View className={`ff-menu-row__icon ff-menu-row__icon--${item.available ? 'green' : 'blue'}`}>
                    {item.name.slice(0, 1)}
                  </View>
                  <View className='ff-menu-row__body'>
                    <Text>{item.name}</Text>
                    <Text>{item.title}</Text>
                    <Text>{item.specialty || '老年心理、家庭照护'}</Text>
                    <Text>{item.next_available_text || item.availability_text || '等待咨询师确认可约时段'}</Text>
                  </View>
                  <View>
                    <Text className={`ff-chip ff-chip--${item.available ? 'green' : 'amber'}`}>
                      {item.available ? '可预约' : '需排期'}
                    </Text>
                    <Text className='ff-green-link' onClick={() => void createReservation(quickSlots[0], item)}>
                      预约最近时段
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View className='ff-record-row ff-record-row--simple'>
                <View className='ff-record-row__body'>
                  <Text>当前还没有可用咨询师</Text>
                  <Text>{loading ? '正在同步咨询师列表...' : '后端补充咨询师数据后，这里会自动展示。'}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>咨询记录</Text>
          <View className='ff-list'>
            {historyConsultations.length ? (
              historyConsultations.map((item) => (
                <View className='ff-record-row ff-record-row--simple' key={item.id}>
                  <View className='ff-record-row__body'>
                    <Text>{getTypeLabel(item.consultation_type)}</Text>
                    <Text>{formatDateTimeText(item.scheduled_time)} · {item.counselor_name || '待分配咨询师'}</Text>
                    <Text>{item.family_visible_summary || item.note || '本次咨询没有补充备注。'}</Text>
                  </View>
                  <Text className={`ff-chip ff-chip--${getStatusLabel(item.status).tone}`}>{getStatusText(item)}</Text>
                </View>
              ))
            ) : (
              <View className='ff-record-row ff-record-row--simple'>
                <View className='ff-record-row__body'>
                  <Text>还没有历史咨询记录</Text>
                  <Text>{loading ? '正在同步咨询记录...' : '预约完成并结束后，记录会自动归档到这里。'}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>

      <BottomNav active='dashboard' />
    </View>
  );
}
