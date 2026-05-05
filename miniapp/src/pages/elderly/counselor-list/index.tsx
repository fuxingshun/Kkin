import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { AppIcon } from '@/components/AppIcon';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';
import { EmptyState } from '@/components/EmptyState';
import {
  createConsultation,
  getConsultations,
  getCounselors,
  updateConsultation,
  type Consultation,
  type Counselor,
} from '@/services/elderly';
import { formatDateTimeText, formatDateTimeValue } from '@/utils/format';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';

const filterOptions = [
  { id: 'all', label: '全部' },
  { id: 'online', label: '可预约' },
  { id: 'high-rating', label: '高评分' },
  { id: 'experienced', label: '资深' },
] as const;

const categoryMatchRules = [
  { triggers: ['情绪疏导', '情绪', '心情'], specialties: ['情绪疏导'] },
  { triggers: ['睡眠问题', '睡不好', '失眠', '睡眠'], specialties: ['睡眠问题', '睡眠改善', '失眠'] },
  { triggers: ['慢病心理', '慢病'], specialties: ['慢病心理'] },
  { triggers: ['家庭关系', '子女', '沟通', '家庭'], specialties: ['家庭关系'] },
  { triggers: ['退休适应', '退休'], specialties: ['退休适应'] },
  { triggers: ['记忆认知', '忘事', '记忆', '认知'], specialties: ['记忆认知'] },
  { triggers: ['失落哀伤', '失落', '哀伤', '丧亲'], specialties: ['失落哀伤'] },
  { triggers: ['健康焦虑', '焦虑', '担心'], specialties: ['健康焦虑'] },
];

function getInitialFilter() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const filter = params.filter;
  return filterOptions.some((item) => item.id === filter) ? String(filter) : 'all';
}

function getInitialTopic() {
  const params = Taro.getCurrentInstance().router?.params || {};
  return params.topic ? decodeURIComponent(String(params.topic)) : '';
}

function getRatingValue(value?: string) {
  const rating = Number.parseFloat(String(value || '0'));
  return Number.isFinite(rating) ? rating : 0;
}

function getExperienceValue(value?: string) {
  const match = String(value || '').match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

function getTopicMatchRule(topic: string) {
  const normalizedTopic = topic.trim();
  if (!normalizedTopic) return undefined;
  return categoryMatchRules.find((rule) => rule.triggers.some((trigger) => normalizedTopic.includes(trigger)));
}

function buildScheduledTime() {
  return formatDateTimeValue(new Date(Date.now() + 60 * 60 * 1000));
}

export default function ElderlyCounselorListPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const [selectedFilter, setSelectedFilter] = useState(getInitialFilter);
  const [topic] = useState(getInitialTopic);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nextCounselors, nextConsultations] = await Promise.all([
        getCounselors(),
        getConsultations(undefined, undefined, 10),
      ]);
      setCounselors(nextCounselors);
      setConsultations(nextConsultations);
    } catch (error) {
      const message = error instanceof Error ? error.message : '咨询师加载失败';
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

  const filteredCounselors = useMemo(() => {
    const list = [...counselors];
    const topicRule = getTopicMatchRule(topic);
    return list
      .filter((item) => {
        if (topicRule && !topicRule.specialties.some((specialty) => String(item.specialty || '').includes(specialty))) {
          return false;
        }
        if (selectedFilter === 'online') return item.available;
        if (selectedFilter === 'high-rating') return getRatingValue(item.rating) >= 4.7;
        if (selectedFilter === 'experienced') return getExperienceValue(item.experience) >= 10;
        return true;
      })
      .sort((left, right) => {
        if (Number(right.available) !== Number(left.available)) {
          return Number(right.available) - Number(left.available);
        }
        return getRatingValue(right.rating) - getRatingValue(left.rating);
      });
  }, [counselors, selectedFilter, topic]);

  const activeConsultations = useMemo(
    () => consultations.filter((item) => item.status !== 'completed' && item.status !== 'cancelled').slice(0, 2),
    [consultations]
  );

  async function bookCounselor(counselor: Counselor, consultationType: Consultation['consultation_type']) {
    if (!counselor.available) {
      Taro.showToast({ title: '该咨询师当前不可预约', icon: 'none' });
      return;
    }

    try {
      setBookingId(counselor.id);
      await createConsultation({
        counselor_id: counselor.id,
        consultation_type: consultationType === 'video' ? 'video' : 'phone',
        scheduled_time: buildScheduledTime(),
        duration: 45,
        note: `老人端预约：${counselor.name}`,
      });
      Taro.showToast({ title: '预约已提交', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '预约失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setBookingId(null);
    }
  }

  async function bookCounselorWithSync(counselor: Counselor, consultationType: Consultation['consultation_type']) {
    if (!counselor.available) {
      Taro.showToast({ title: '该咨询师当前不可预约', icon: 'none' });
      return;
    }

    try {
      setBookingId(counselor.id);
      await createConsultation({
        counselor_id: counselor.id,
        consultation_type: consultationType === 'video' ? 'video' : 'phone',
        scheduled_time: buildScheduledTime(),
        duration: 45,
        notify_service: true,
        concern_level: 'medium',
        topic: topic || counselor.specialty || '心理咨询预约',
        note: `老人端预约：${counselor.name}${topic ? `｜主题：${topic}` : ''}`,
      });
      Taro.showToast({ title: '预约已提交', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '预约失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setBookingId(null);
    }
  }

  async function cancelConsultation(item: Consultation) {
    const result = await Taro.showModal({
      title: '取消预约',
      content: '取消后服务端协同状态会同步更新。',
    });
    if (!result.confirm) {
      return;
    }

    try {
      setCancelingId(item.id);
      await updateConsultation(item.id, {
        status: 'cancelled',
        note: `${item.note || '心理咨询预约'}（老人端已取消）`,
      });
      Taro.showToast({ title: '已取消', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '取消失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <View className={`pc-page counselor-page ef-page--tab ${preferenceClassName}`}>
      <View className='pc-sub-topbar'>
        <View className='pc-topbar-button' onClick={() => Taro.navigateBack()}>
          <AppIcon name='chevron-left' />
        </View>
        <Text className='pc-sub-title'>咨询师列表</Text>
        <View className='pc-topbar-button' onClick={() => void loadData()}>
          <AppIcon name='refresh' />
        </View>
      </View>

      <View className='pc-filter-strip'>
        {filterOptions.map((option) => (
          <Text
            key={option.id}
            className={`pc-filter ${selectedFilter === option.id ? 'pc-filter--active' : ''}`}
            onClick={() => setSelectedFilter(option.id)}
          >
            {option.label}
          </Text>
        ))}
      </View>

      {(topic || activeConsultations.length) ? (
        <View className='pc-section pc-section--compact'>
          <View className='pc-support-panel pc-support-panel--list'>
            {topic ? (
              <View className='pc-topic-banner'>
                <Text className='pc-topic-banner__label'>本次咨询主题</Text>
                <Text className='pc-topic-banner__text'>{topic}</Text>
              </View>
            ) : null}
            {activeConsultations.length ? (
              <View className='pc-consult-mini-list'>
                {activeConsultations.map((item) => (
                  <View className='pc-consult-status-card' key={item.id}>
                    <View className='pc-consult-status-card__body'>
                      <Text className='pc-consult-status-title'>{item.counselor_name || '服务人员待确认'}</Text>
                      <Text className='pc-consult-status-meta'>{formatDateTimeText(item.scheduled_time)} · {item.status}</Text>
                    </View>
                    <Button
                      className='pc-support-mini-button'
                      loading={cancelingId === item.id}
                      onClick={() => void cancelConsultation(item)}
                    >
                      取消
                    </Button>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <View className='pc-counselor-content'>
        <View className='pc-list-title-row'>
          <AppIcon name='check' className='pc-title-icon' />
          <Text className='pc-section-title'>为您匹配</Text>
          <Text className='pc-list-caption'>按可预约状态和评分排序</Text>
        </View>

        <View className='pc-counselor-list'>
          {filteredCounselors.length ? (
            filteredCounselors.map((counselor) => (
              <View className='pc-counselor-card' key={counselor.id}>
                <View className='pc-counselor-card__top'>
                  <View className='pc-match-chip'>
                    <AppIcon name='star' />
                    <Text>{counselor.rating || '暂无评分'}</Text>
                  </View>
                  <Text className={`pc-status-chip ${counselor.available ? 'pc-status-chip--online' : ''}`}>
                    {counselor.available ? '可预约' : '暂不可约'}
                  </Text>
                </View>

                <View
                  className='pc-counselor-info'
                  onClick={() => Taro.navigateTo({ url: `/pages/elderly/counselor-detail/index?id=${counselor.id}` })}
                >
                  <View className='pc-counselor-avatar'>
                    <Text>{counselor.name.slice(0, 1)}</Text>
                  </View>
                  <View className='pc-counselor-info__body'>
                    <Text className='pc-counselor-name'>{counselor.name}</Text>
                    <Text className='pc-counselor-title'>{counselor.title}</Text>
                    <Text className='pc-counselor-meta'>
                      从业 {counselor.experience || '暂无'} · {counselor.rating || '暂无评分'}
                    </Text>
                  </View>
                </View>

                <View className='pc-specialty'>
                  <Text>擅长领域：{counselor.specialty || '老人心理支持'}</Text>
                </View>

                <View className='pc-action-row'>
                  <Button
                    className={`pc-action-button pc-action-button--plain ${!counselor.available ? 'pc-action-button--disabled' : ''}`}
                    disabled={!counselor.available}
                    loading={bookingId === counselor.id}
                    onClick={() => void bookCounselorWithSync(counselor, 'phone')}
                  >
                    电话咨询
                  </Button>
                  <Button
                    className={`pc-action-button pc-action-button--primary ${!counselor.available ? 'pc-action-button--disabled' : ''}`}
                    disabled={!counselor.available}
                    loading={bookingId === counselor.id}
                    onClick={() => void bookCounselorWithSync(counselor, 'video')}
                  >
                    视频咨询
                  </Button>
                </View>
              </View>
            ))
          ) : (
            <EmptyState title={loading ? '正在加载咨询师' : '暂无匹配咨询师'} hint='请稍后刷新，或切换筛选条件。' />
          )}
        </View>
      </View>

      <View className='pc-section pc-section--tip'>
        <View className='pc-blue-tip'>
          <Text className='pc-tip-title'>预约说明</Text>
          <Text className='pc-blue-tip-text'>预约会同步到家属端和服务端咨询记录，服务人员可继续跟进。</Text>
        </View>
      </View>

      <ElderlyTabBar active='consulting' />
    </View>
  );
}
