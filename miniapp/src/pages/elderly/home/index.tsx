import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Image, Text, View } from '@tarojs/components';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';
import {
  getElderlyCareInsight,
  getFamilyUsers,
  getLatestMood,
  getMediaUrl,
  getPendingMessages,
  getRecommendedMedia,
  getThumbnailUrl,
  getTodaySchedules,
  markAsPlayed,
  moodLabelMap,
  updateScheduleStatus,
  type CareInsight,
  type ElderlyMessage,
  type FamilyUser,
  type RecommendedMedia,
  type Schedule,
} from '@/services/elderly';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';
import { getElderlySession } from '@/utils/session';

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value?: string) {
  const date = parseDate(value);
  if (!date) return '--:--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getScheduleIcon(type?: Schedule['schedule_type']): AppIconName {
  if (type === 'medication') return 'shield';
  if (type === 'exercise') return 'heart';
  if (type === 'meal') return 'clock';
  if (type === 'checkup') return 'check';
  return 'bell';
}

const coreActions: Array<{ label: string; hint: string; icon: AppIconName; url: string; tone: string }> = [
  { label: '陪我聊', hint: '打开 AI 陪伴', icon: 'message', url: '/pages/elderly/companion/index', tone: 'blue' },
  { label: '联系家人', hint: '一键求助', icon: 'phone', url: '/pages/elderly/help/index', tone: 'green' },
  { label: '今日任务', hint: '查看提醒', icon: 'calendar', url: '/pages/elderly/reminders/index', tone: 'amber' },
  { label: '记录心情', hint: '写下今天', icon: 'heart', url: '/pages/elderly/record/index', tone: 'pink' },
];

function getGreetingName(users: FamilyUser[]) {
  const elderly = users.find((item) => item.user_type === 'elderly');
  if (!elderly?.name) return '王先生';
  return elderly.name;
}

function getDateText() {
  const now = new Date();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${weekdays[now.getDay()]}，${now.getMonth() + 1}月${now.getDate()}日`;
}

function getDailyRandomIndex(length: number, elderlyId: number) {
  if (!length) return 0;
  const now = new Date();
  const seed = Number(`${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}${elderlyId || 0}`);
  const mixedSeed = ((seed * 9301 + 49297) % 233280) / 233280;
  return Math.floor(mixedSeed * length);
}
export default function ElderlyHomePage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const { familyId, elderlyId, elderName, wechatOpenid } = getElderlySession();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [messages, setMessages] = useState<ElderlyMessage[]>([]);
  const [mediaList, setMediaList] = useState<RecommendedMedia[]>([]);
  const [careInsight, setCareInsight] = useState<CareInsight | null>(null);
  const [moodLabel, setMoodLabel] = useState('未记录');

  const loadData = useCallback(async () => {
    if (!wechatOpenid) {
      void Taro.redirectTo({ url: '/pages/role/index' });
      return;
    }

    try {
      setLoading(true);
      const [nextUsers, todaySchedules, pendingMessages, recommendedMedia, latestMood, nextInsight] = await Promise.all([
        getFamilyUsers(familyId),
        getTodaySchedules(familyId),
        getPendingMessages(familyId),
        getRecommendedMedia(familyId, elderlyId),
        getLatestMood(familyId, elderlyId),
        getElderlyCareInsight(familyId, elderlyId),
      ]);

      setUsers(nextUsers);
      setSchedules(todaySchedules);
      setMessages(pendingMessages);
      setMediaList(recommendedMedia);
      setCareInsight(nextInsight);
      setMoodLabel(latestMood ? moodLabelMap[latestMood.mood_type] : '未记录');
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '加载失败';
      Taro.showToast({ title: messageText, icon: 'none' });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, [elderlyId, familyId, wechatOpenid]);

  useDidShow(() => {
    void loadData();
  });

  usePullDownRefresh(() => {
    void loadData();
  });

  const visibleSchedules = useMemo(
    () => schedules.filter((item) => item.status !== 'completed' && item.status !== 'skipped' && item.status !== 'missed').slice(0, 3),
    [schedules]
  );
  const currentMedia = useMemo(() => {
    if (!mediaList.length) return null;
    return mediaList[getDailyRandomIndex(mediaList.length, elderlyId)] || mediaList[0] || null;
  }, [elderlyId, mediaList]);
  const greetingName = users.length ? getGreetingName(users) : elderName || '王先生';
  const pendingMessageCount = messages.length;

  async function completeSchedule(scheduleId?: number) {
    if (!scheduleId) return;
    try {
      await updateScheduleStatus(scheduleId, 'completed');
      Taro.showToast({ title: '已完成', icon: 'success' });
      await loadData();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '操作失败';
      Taro.showToast({ title: messageText, icon: 'none' });
    }
  }

  async function handleReadMessage(messageId?: number) {
    if (!messageId) return;
    try {
      await markAsPlayed(messageId);
      Taro.showToast({ title: '已收到留言', icon: 'success' });
      await loadData();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '操作失败';
      Taro.showToast({ title: messageText, icon: 'none' });
    }
  }

  return (
    <View className={`ef-page ef-page--tab ef-home ${preferenceClassName}`}>
      <View className='ef-home-hero' style={{ background: '#5B6FD8' }}>
        <View className='ef-home-hero__top'>
          <View>
            <Text className='ef-home-hero__date'>{getDateText()}</Text>
            <Text className='ef-home-hero__title'>您好，{greetingName}</Text>
          </View>
          <Button
            className='ef-icon-button ef-icon-button--glass'
            onClick={() => Taro.navigateTo({ url: '/pages/elderly/reminders/index' })}
          >
            <AppIcon name='bell' />
          </Button>
        </View>
        <View className='ef-home-status'>
          <AppIcon name='clock' className='ef-home-status__icon' />
          <Text>{loading ? '正在同步今日数据' : `今日 ${visibleSchedules.length} 项待办 · 情绪${moodLabel}`}</Text>
        </View>
      </View>

      <View className='ef-core-actions'>
        {coreActions.map((item) => (
          <View
            className={`ef-core-action ef-core-action--${item.tone}`}
            key={item.label}
            onClick={() => Taro.navigateTo({ url: item.url })}
          >
            <View className='ef-core-action__icon'>
              <AppIcon name={item.icon} />
            </View>
            <View className='ef-core-action__body'>
              <Text className='ef-core-action__label'>{item.label}</Text>
              <Text className='ef-core-action__hint'>{item.hint}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className={`ef-greeting-card ef-care-insight ef-care-insight--${careInsight?.risk_level || 'low'}`}>
        <View className='ef-round-icon ef-round-icon--green'>
          <AppIcon name='shield' />
        </View>
        <View className='ef-greeting-card__body'>
          <Text className='ef-card-title'>今日守护 · {careInsight?.status_label || '正在同步'}</Text>
          <Text className='ef-card-text'>
            {careInsight?.elderly_message || '正在汇总今天的照护任务、留言和情绪记录。'}
          </Text>
          <Text className='ef-card-meta'>
            任务完成 {careInsight?.metrics?.completion_rate ?? 0}%
            {pendingMessageCount ? ` · ${pendingMessageCount} 条待处理留言` : ' · 暂无待处理留言'}
          </Text>
        </View>
      </View>

      <View className='ef-home-card ef-home-card--overlap'>
        <View className='ef-section-head'>
          <Text className='ef-section-title'>今日任务</Text>
          <Text className='ef-link' onClick={() => Taro.navigateTo({ url: '/pages/elderly/reminders/index' })}>
            查看全部
          </Text>
        </View>
        <View className='ef-list'>
          {visibleSchedules.length ? (
            visibleSchedules.map((item) => {
              const done = item.status === 'completed';
              return (
                <View className={`ef-reminder ${done ? 'ef-reminder--done' : ''}`} key={item.id || item.title}>
                  <View className={`ef-reminder__icon ${done ? 'ef-reminder__icon--done' : ''}`}>
                    <AppIcon name={getScheduleIcon(item.schedule_type)} />
                  </View>
                  <View className='ef-reminder__body'>
                    <View className='ef-inline'>
                      <Text className='ef-card-title'>{item.title}</Text>
                      <Text className={`ef-pill ${done ? 'ef-pill--done' : 'ef-pill--wait'}`}>{formatTime(item.schedule_time)}</Text>
                    </View>
                    <Text className='ef-card-text'>{item.description || '家人为您设置的提醒'}</Text>
                  </View>
                  {!done ? <Button className='ef-small-primary' onClick={() => completeSchedule(item.id)}>完成</Button> : null}
                </View>
              );
            })
          ) : (
            <View className='ef-reminder'>
              <View className='ef-reminder__icon'><AppIcon name='check' /></View>
              <View className='ef-reminder__body'>
                <Text className='ef-card-title'>暂无待办任务</Text>
                <Text className='ef-card-text'>家属端新增护理计划后会同步显示</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View className='ef-greeting-card'>
        <View className='ef-round-icon ef-round-icon--warm'>
          <AppIcon name='heart' />
        </View>
        <View className='ef-greeting-card__body'>
          <Text className='ef-card-title'>家属关怀</Text>
          <View className='ef-family-messages'>
            {messages.length ? (
              messages.map((item) => (
                <View className='ef-family-message' key={item.id || item.created_at || item.content}>
                  <Text className='ef-card-text ef-family-message__content'>
                    {item.sender_relation || item.sender_name || '家人'}：{item.content}
                  </Text>
                  <Text className='ef-warm-link ef-family-message__action' onClick={() => handleReadMessage(item.id)}>
                    我已收到 〉
                  </Text>
                </View>
              ))
            ) : (
              <Text className='ef-card-text'>家属发送的留言和关怀信息将在此显示</Text>
            )}
          </View>
        </View>
      </View>

      <View className='ef-memory-preview'>
        <Text className='ef-section-title'>今日回忆</Text>
        <View className='ef-memory-cover' onClick={() => Taro.redirectTo({ url: '/pages/elderly/memories/index' })}>
          <View className='ef-memory-cover__stage'>
            {currentMedia ? (
              <Image
                className='ef-memory-player__image'
                mode='aspectFill'
                src={currentMedia.thumbnail_path ? getThumbnailUrl(currentMedia.thumbnail_path) : getMediaUrl(currentMedia.file_path)}
              />
            ) : (
              <View className='ef-round-icon ef-round-icon--blue'>
                <AppIcon name='image' />
              </View>
            )}
            <Text className='ef-memory-cover__hint'>点击查看今日回忆</Text>
          </View>
        </View>
      </View>

      <View className='ef-quick-section'>
        <Text className='ef-section-title'>更多支持</Text>
        <View className='ef-quick-grid'>
          <View className='ef-quick-card' onClick={() => Taro.navigateTo({ url: '/pages/elderly/counselor-list/index' })}>
            <View className='ef-round-icon ef-round-icon--primary'>
              <AppIcon name='message' />
            </View>
            <Text>心理咨询</Text>
          </View>
          <View className='ef-quick-card' onClick={() => Taro.navigateTo({ url: '/pages/elderly/mental-screening/index' })}>
            <View className='ef-round-icon ef-round-icon--warm'>
              <AppIcon name='heart' />
            </View>
            <Text>心理检测</Text>
          </View>
        </View>
      </View>

      <View className='ef-record-entry' onClick={() => Taro.redirectTo({ url: '/pages/elderly/record/index' })}>
        <View className='ef-round-icon ef-round-icon--record'>
          <AppIcon name='text' />
        </View>
        <View className='ef-record-entry__body'>
          <Text className='ef-record-entry__title'>今日记录</Text>
          <Text className='ef-record-entry__desc'>记录情绪、睡眠、饮食等健康数据</Text>
        </View>
        <AppIcon name='chevron-right' className='ef-record-entry__trend' />
      </View>

      <ElderlyTabBar active='home' />
    </View>
  );
}

