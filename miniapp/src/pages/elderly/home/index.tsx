import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';
import {
  getElderlyMessages,
  getFamilyUsers,
  getLatestMood,
  getPendingMessages,
  getRecommendedMedia,
  getTodaySchedules,
  markAsPlayed,
  moodLabelMap,
  updateScheduleStatus,
  type ElderlyMessage,
  type FamilyUser,
  type RecommendedMedia,
  type Schedule,
} from '@/services/elderly';
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
  if (!elderly?.name) return '您好';
  return elderly.name.endsWith('花') ? '张阿姨' : elderly.name;
}

function getDateText() {
  const now = new Date();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${weekdays[now.getDay()]} · ${now.getMonth() + 1}月${now.getDate()}日`;
}

export default function ElderlyHomePage() {
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
      const [nextUsers, todaySchedules, pendingMessages, allMessages, recommendedMedia, latestMood] = await Promise.all([
        getFamilyUsers(familyId),
        getTodaySchedules(familyId),
        getPendingMessages(familyId),
        getElderlyMessages(familyId),
        getRecommendedMedia(familyId, elderlyId),
        getLatestMood(familyId, elderlyId),
      ]);

      setUsers(nextUsers);
      setSchedules(todaySchedules);
      setMessage(pendingMessages[0] || allMessages[0] || null);
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

  const visibleSchedules = useMemo(() => schedules.slice(0, 3), [schedules]);
  const currentMedia = mediaList[0] || null;

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
    <View className='ef-page ef-page--tab ef-home'>
      <View className='ef-home-hero'>
        <View className='ef-home-hero__top'>
          <View>
            <Text className='ef-home-hero__date'>{getDateText()}</Text>
            <Text className='ef-home-hero__title'>{users.length ? getGreetingName(users) : elderName}，早上好</Text>
          </View>
          <Button className='ef-icon-button ef-icon-button--glass'>{moodLabel.slice(0, 1)}</Button>
        </View>
        <View className='ef-weather'>
          <Text className='ef-weather__icon'>晴</Text>
          <Text>{loading ? '正在同步今日数据' : `今日状态 · ${moodLabel} · ${schedules.length}个提醒`}</Text>
        </View>
      </View>

      <View className='ef-block ef-block--overlap'>
        <View className='ef-section-head'>
          <Text className='ef-section-title'>今日提醒</Text>
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
              <View className='ef-reminder__icon'><Text>安</Text></View>
              <View className='ef-reminder__body'>
                <Text className='ef-card-title'>今天暂无提醒</Text>
                <Text className='ef-card-text'>家人新增护理计划后会自动出现在这里。</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View className='ef-greeting-card'>
        <View className='ef-round-icon ef-round-icon--warm'>
          <Text>心</Text>
        </View>
        <View className='ef-greeting-card__body'>
          <Text className='ef-card-title'>{message ? `${message.sender_relation}给您发来留言` : '家人的留言'}</Text>
          <Text className='ef-card-text'>{message ? `"${message.content}"` : '暂时没有新留言，家人发来的话会出现在这里。'}</Text>
          {message ? <Text className='ef-warm-link' onClick={handleReadMessage}>我已收到 〉</Text> : null}
        </View>
      </View>

      <View className='ef-memory-preview'>
        <Text className='ef-section-title'>今日回忆</Text>
        <View className='ef-memory-cover' onClick={() => Taro.redirectTo({ url: '/pages/elderly/memories/index' })}>
          <View className='ef-memory-cover__stage'>
            <View className='ef-round-icon ef-round-icon--blue'>
              <Text>{currentMedia?.media_type === 'video' ? '视' : '忆'}</Text>
            </View>
            <Text className='ef-memory-cover__hint'>{currentMedia ? '点击查看今日回忆' : '等待家人上传回忆'}</Text>
          </View>
          <View className='ef-memory-cover__info'>
            <Text className='ef-card-title'>{currentMedia?.title || '暂无回忆内容'}</Text>
            <Text className='ef-card-text'>{currentMedia?.description || '家属端上传照片或视频后会同步到这里'}</Text>
          </View>
        </View>
      </View>

      <View className='ef-quick-grid'>
        <View className='ef-quick-card' onClick={() => Taro.navigateTo({ url: '/pages/elderly/help/index' })}>
          <View className='ef-round-icon ef-round-icon--primary'>
            <Text>电</Text>
          </View>
          <Text>联系家人</Text>
        </View>
        <View className='ef-quick-card' onClick={() => Taro.redirectTo({ url: '/pages/elderly/companion/index' })}>
          <View className='ef-round-icon ef-round-icon--green'>
            <Text>陪</Text>
          </View>
          <Text>AI陪伴</Text>
        </View>
        <View className='ef-quick-card ef-quick-card--wide' onClick={() => Taro.navigateTo({ url: '/pages/elderly/counseling/index' })}>
          <View className='ef-round-icon ef-round-icon--white'>
            <Text>询</Text>
          </View>
          <Text className='ef-quick-card__title'>心理咨询</Text>
          <Text className='ef-quick-card__desc'>专业心理咨询师为您服务</Text>
        </View>
      </View>

      <ElderlyTabBar active='home' />
    </View>
  );
}
