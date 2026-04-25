import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Image, Text, View } from '@tarojs/components';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';
import {
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

function getScheduleMark(type?: Schedule['schedule_type']) {
  if (type === 'medication') return '药';
  if (type === 'exercise') return '动';
  if (type === 'meal') return '水';
  if (type === 'checkup') return '查';
  return '提';
}

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
  const { familyId, elderlyId, elderName } = getElderlySession();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [message, setMessage] = useState<ElderlyMessage | null>(null);
  const [mediaList, setMediaList] = useState<RecommendedMedia[]>([]);
  const [moodLabel, setMoodLabel] = useState('未记录');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nextUsers, todaySchedules, pendingMessages, recommendedMedia, latestMood] = await Promise.all([
        getFamilyUsers(familyId),
        getTodaySchedules(familyId),
        getPendingMessages(familyId),
        getRecommendedMedia(familyId, elderlyId),
        getLatestMood(familyId, elderlyId),
      ]);

      setUsers(nextUsers);
      setSchedules(todaySchedules);
      setMessage(pendingMessages[0] || null);
      setMediaList(recommendedMedia);
      setMoodLabel(latestMood ? moodLabelMap[latestMood.mood_type] : '未记录');
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '加载失败';
      Taro.showToast({ title: messageText, icon: 'none' });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, [elderlyId, familyId]);

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

  async function handleReadMessage() {
    if (!message?.id) return;
    try {
      await markAsPlayed(message.id);
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
            铃
          </Button>
        </View>
        <View className='ef-home-status'>
          <Text className='ef-home-status__icon'>时</Text>
          <Text>{loading ? '正在同步今日数据' : `今日 ${visibleSchedules.length} 项待办 · 情绪${moodLabel}`}</Text>
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
                    <Text>{getScheduleMark(item.schedule_type)}</Text>
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
              <View className='ef-reminder__icon'><Text>✓</Text></View>
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
          <Text>♡</Text>
        </View>
        <View className='ef-greeting-card__body'>
          <Text className='ef-card-title'>家属关怀</Text>
          <Text className='ef-card-text'>{message ? `${message.sender_relation}：${message.content}` : '家属发送的留言和关怀信息将在此显示'}</Text>
          {message ? <Text className='ef-warm-link' onClick={handleReadMessage}>我已收到 〉</Text> : null}
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
                <Text>♡</Text>
              </View>
            )}
            <Text className='ef-memory-cover__hint'>点击查看今日回忆</Text>
          </View>
        </View>
      </View>

      <View className='ef-quick-section'>
        <Text className='ef-section-title'>快捷功能</Text>
        <View className='ef-quick-grid'>
          <View className='ef-quick-card' onClick={() => Taro.navigateTo({ url: '/pages/elderly/help/index' })}>
            <View className='ef-round-icon ef-round-icon--primary'>
              <Text>电</Text>
            </View>
            <Text>联系家人</Text>
          </View>
          <View className='ef-quick-card' onClick={() => Taro.redirectTo({ url: '/pages/elderly/companion/index' })}>
            <View className='ef-round-icon ef-round-icon--green'>
              <Text>聊</Text>
            </View>
            <Text>AI陪伴</Text>
          </View>
        </View>
      </View>

      <View className='ef-quick-card ef-quick-card--wide ef-counseling-entry' onClick={() => Taro.navigateTo({ url: '/pages/elderly/counseling/index' })}>
          <View className='ef-round-icon ef-round-icon--white'>
            <Text>人</Text>
          </View>
          <Text className='ef-quick-card__title'>心理咨询服务</Text>
          <Text className='ef-quick-card__desc'>专业心理咨询师随时为您提供支持</Text>
      </View>

      <ElderlyTabBar active='home' />
    </View>
  );
}

