import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';
import {
  getAlertStats,
  getFamilyMessages,
  getFamilySchedules,
  getFamilyUsers,
  getMoodStats,
  getRecentPlays,
  moodLabelMap,
  queryFamilyMoodRecords,
  type FamilyMessage,
  type FamilyUser,
  type MoodRecord,
  type MoodStatsResponse,
  type RecentPlay,
  type Schedule,
} from '@/services/family';
import { countTodayMemberMessages, getInteractionHistory, sanitizeInteractionContent } from '@/services/interaction';
import { formatDateTimeText, formatRelativeTime } from '@/utils/format';
import { useNavigationMetrics } from '@/utils/navigation';

const quickActions = [
  { label: '情绪历史', path: '/pages/family/moods/index', tone: 'indigo' },
  { label: '查看周报', path: '/pages/family/reports/index', tone: 'amber' },
  { label: '预约咨询', path: '/pages/family/counseling/index', tone: 'pink' },
] as const;

type AlertStats = Awaited<ReturnType<typeof getAlertStats>>;

function isSameDay(value?: string, now = new Date()) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getShortDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getMoodTrendLabel(score: number) {
  if (score >= 8) return '很好';
  if (score >= 6) return '平稳';
  if (score >= 4) return '需要关注';
  return '波动偏大';
}

function getScheduleTypeLabel(type?: Schedule['schedule_type']) {
  switch (type) {
    case 'medication':
      return '用药提醒';
    case 'meal':
      return '饮食提醒';
    case 'exercise':
      return '活动提醒';
    case 'checkup':
      return '复诊安排';
    default:
      return '其他计划';
  }
}

function summarizeScheduleProgress(list: Schedule[]) {
  const buckets: Record<string, { total: number; completed: number }> = {};

  list.forEach((item) => {
    const key = item.schedule_type || 'other';
    if (!buckets[key]) {
      buckets[key] = { total: 0, completed: 0 };
    }

    buckets[key].total += 1;
    if (item.status === 'completed') {
      buckets[key].completed += 1;
    }
  });

  return Object.entries(buckets)
    .map(([type, value]) => ({
      type,
      label: getScheduleTypeLabel(type as Schedule['schedule_type']),
      total: value.total,
      completed: value.completed,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
}

export default function FamilyDashboardPage() {
  const navigation = useNavigationMetrics();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [moods, setMoods] = useState<MoodRecord[]>([]);
  const [moodStats, setMoodStats] = useState<MoodStatsResponse | null>(null);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [recentPlays, setRecentPlays] = useState<RecentPlay[]>([]);
  const [todayInteractionCount, setTodayInteractionCount] = useState(0);
  const [latestInteraction, setLatestInteraction] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const results = await Promise.allSettled([
        getFamilyUsers(),
        getFamilyMessages(),
        getFamilySchedules(),
        queryFamilyMoodRecords(undefined, { limit: 10 }),
        getMoodStats(undefined, 7),
        getAlertStats(),
        getRecentPlays(undefined, 5),
        getInteractionHistory(undefined, 60),
      ]);

      const [usersResult, messagesResult, schedulesResult, moodsResult, moodStatsResult, alertStatsResult, recentPlaysResult, interactionResult] =
        results;
      let hasFailed = false;

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      } else {
        hasFailed = true;
      }

      if (messagesResult.status === 'fulfilled') {
        setMessages(messagesResult.value);
      } else {
        hasFailed = true;
      }

      if (schedulesResult.status === 'fulfilled') {
        setSchedules(schedulesResult.value);
      } else {
        hasFailed = true;
      }

      if (moodsResult.status === 'fulfilled') {
        setMoods(moodsResult.value);
      } else {
        hasFailed = true;
      }

      if (moodStatsResult.status === 'fulfilled') {
        setMoodStats(moodStatsResult.value);
      } else {
        hasFailed = true;
      }

      if (alertStatsResult.status === 'fulfilled') {
        setAlertStats(alertStatsResult.value);
      } else {
        hasFailed = true;
      }

      if (recentPlaysResult.status === 'fulfilled') {
        setRecentPlays(recentPlaysResult.value);
      } else {
        hasFailed = true;
      }

      if (interactionResult.status === 'fulfilled') {
        setTodayInteractionCount(countTodayMemberMessages(interactionResult.value.list));
        const latestItem = interactionResult.value.list.find((item) => Boolean(sanitizeInteractionContent(item.content)));
        setLatestInteraction(latestItem ? sanitizeInteractionContent(latestItem.content) : '');
      } else {
        hasFailed = true;
        setTodayInteractionCount(0);
        setLatestInteraction('');
      }

      if (hasFailed) {
        Taro.showToast({ title: '部分数据同步失败', icon: 'none' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '概览加载失败';
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

  const elderUser = useMemo(() => users.find((item) => item.user_type === 'elderly') ?? null, [users]);
  const familyUsers = useMemo(() => users.filter((item) => item.user_type === 'family'), [users]);
  const latestMood = moods[0] ?? null;
  const todaySchedules = useMemo(() => schedules.filter((item) => isSameDay(item.schedule_time)), [schedules]);
  const completedToday = todaySchedules.filter((item) => item.status === 'completed').length;
  const completionRate = todaySchedules.length
    ? Math.round((completedToday / todaySchedules.length) * 100)
    : 0;
  const pendingMessages = messages.filter((item) => !item.played).length;
  const moodAverage = moodStats?.overall.avg_score ?? latestMood?.mood_score ?? 0;
  const moodTrend = moodStats?.daily_stats.slice().reverse() ?? [];
  const scheduleSummary = summarizeScheduleProgress(todaySchedules);

  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-hero' style={navigation.heroStyle}>
        <View className='ff-hero__top'>
          <View>
            <Text className='ff-kicker'>正在照护</Text>
            <Text className='ff-hero__title'>{elderUser?.name || '当前老人'}（家庭视角）</Text>
          </View>
          <View className='ff-avatar'>
            <Text>{(elderUser?.name || '家').slice(0, 1)}</Text>
          </View>
        </View>
        <View className='ff-stat-grid'>
          <View className='ff-hero-stat'>
            <Text>{latestMood ? moodLabelMap[latestMood.mood_type] : '暂无'}</Text>
            <Text>最新情绪</Text>
          </View>
          <View className='ff-hero-stat'>
            <Text>{todayInteractionCount}</Text>
            <Text>今日互动</Text>
          </View>
          <View className='ff-hero-stat'>
            <Text>{alertStats?.status_stats.unread ?? 0}</Text>
            <Text>未读通知</Text>
          </View>
        </View>
      </View>

      <View className='ff-stack ff-stack--overlap'>
        <View className='ff-card'>
          <View className='ff-section-head'>
            <View>
              <Text className='ff-section-title'>今日提醒完成情况</Text>
              <Text className='ff-card-subtitle'>{todaySchedules.length} 个任务，{completedToday} 个已完成</Text>
            </View>
            <Text className='ff-green-link' onClick={() => Taro.redirectTo({ url: '/pages/family/care/index' })}>
              详情
            </Text>
          </View>
          <View className='ff-progress-list'>
            {scheduleSummary.length ? (
              scheduleSummary.map((item) => (
                <View className='ff-progress-row' key={item.type}>
                  <View>
                    <Text className={`ff-dot ${item.completed === item.total ? 'ff-dot--green' : 'ff-dot--amber'}`} />
                    <Text>{item.label}</Text>
                  </View>
                  <Text className={item.completed === item.total ? '' : 'ff-amber-text'}>
                    {item.completed}/{item.total} 已完成
                  </Text>
                </View>
              ))
            ) : (
              <View className='ff-progress-row'>
                <View>
                  <Text className='ff-dot ff-dot--amber' />
                  <Text>今天还没有安排照护任务</Text>
                </View>
              </View>
            )}
          </View>
          <View className='ff-rate-block'>
            <View className='ff-progress-row'>
              <Text>总完成率</Text>
              <Text className='ff-rate-value'>{completionRate}%</Text>
            </View>
            <View className='ff-progress-track'>
              <View className='ff-progress-fill' style={{ width: `${completionRate}%` }} />
            </View>
          </View>
        </View>

        <View className='ff-card'>
          <View className='ff-section-head'>
            <View>
              <Text className='ff-section-title'>近 7 天情绪走势</Text>
              <Text className='ff-card-subtitle'>平均情绪分 {moodAverage.toFixed(1)}</Text>
            </View>
            <Text className='ff-trend'>{getMoodTrendLabel(moodAverage)}</Text>
          </View>
          <View className='ff-line-chart'>
            {moodTrend.length ? (
              moodTrend.map((item) => (
                <View className='ff-line-chart__item' key={item.date}>
                  <View className='ff-line-chart__track'>
                    <View className='ff-line-chart__bar' style={{ height: `${Math.max(item.avg_score * 10, 12)}%` }} />
                  </View>
                  <Text>{getShortDateLabel(item.date)}</Text>
                </View>
              ))
            ) : (
              <View className='ff-progress-row'>
                <Text>还没有情绪记录</Text>
              </View>
            )}
          </View>
        </View>

        <View className='ff-card'>
          <View className='ff-section-head'>
            <Text className='ff-section-title'>最近观看内容</Text>
            <Text className='ff-green-link' onClick={() => Taro.navigateTo({ url: '/pages/family/media/index' })}>
              管理
            </Text>
          </View>
          <View className='ff-list'>
            {recentPlays.length ? (
              recentPlays.slice(0, 3).map((item) => (
                <View className='ff-media-line' key={`${item.id}-${item.played_at}`}>
                  <View className='ff-media-thumb'>{item.media_type === 'video' ? '视' : '图'}</View>
                  <View className='ff-media-line__body'>
                    <Text>{item.title}</Text>
                    <Text>{formatRelativeTime(item.played_at)} · 喜欢 {item.likes}</Text>
                  </View>
                  <Text className={`ff-heart ${item.likes > item.dislikes ? 'ff-heart--active' : ''}`}>喜</Text>
                </View>
              ))
            ) : (
              <View className='ff-media-line'>
                <View className='ff-media-line__body'>
                  <Text>暂无播放记录</Text>
                  <Text>等老人端开始播放媒体后，这里会自动同步。</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>最近 AI 互动概况</Text>
          <View className='ff-mini-grid'>
            <View className='ff-mini-card ff-mini-card--blue'>
              <Text>{todayInteractionCount}</Text>
              <Text>今日对话</Text>
            </View>
            <View className='ff-mini-card ff-mini-card--amber'>
              <Text>{pendingMessages}</Text>
              <Text>待播留言</Text>
            </View>
          </View>
          <View className='ff-warning-row'>
            <Text>记</Text>
            <Text>{latestInteraction || '最近还没有新的对话摘要，可以下拉刷新后再看。'}</Text>
          </View>
        </View>

        <View className='ff-action-grid'>
          {quickActions.map((item) => (
            <View
              key={item.label}
              className={`ff-action ff-action--${item.tone}`}
              onClick={() => Taro.navigateTo({ url: item.path })}
            >
              <Text className='ff-action__icon'>功</Text>
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>

        <View className='ff-alert-entry' onClick={() => Taro.redirectTo({ url: '/pages/family/alerts/index' })}>
          <View className='ff-alert-icon'>通</View>
          <View className='ff-alert-entry__body'>
            <Text>{alertStats?.status_stats.unhandled ?? 0} 条待处理通知</Text>
            <Text>
              {latestMood?.recorded_at
                ? `最近一次情绪记录：${formatDateTimeText(latestMood.recorded_at)}`
                : '点击查看告警详情'}
            </Text>
          </View>
          <Text className='ff-chevron'>›</Text>
        </View>

        {loading ? <Text className='ff-card-subtitle'>正在同步最新家庭概览...</Text> : null}
        <Text className='ff-card-subtitle'>
          主要照护人：{familyUsers.map((item) => item.name).join('、') || '暂未配置'}
        </Text>
      </View>

      <BottomNav active='dashboard' />
    </View>
  );
}
