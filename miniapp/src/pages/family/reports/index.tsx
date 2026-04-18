import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';
import {
  getAlertStats,
  getFamilyMessages,
  getFamilySchedules,
  getMoodStats,
  getRecentPlays,
  type MoodStatsResponse,
  type RecentPlay,
  type Schedule,
} from '@/services/family';
import { getInteractionHistory } from '@/services/interaction';

function getWeekRangeLabel() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);

  const toText = (value: Date) =>
    `${value.getFullYear()}.${String(value.getMonth() + 1).padStart(2, '0')}.${String(value.getDate()).padStart(2, '0')}`;

  return `${toText(start)} - ${toText(end)}`;
}

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

type AlertStats = Awaited<ReturnType<typeof getAlertStats>>;

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [moodStats, setMoodStats] = useState<MoodStatsResponse | null>(null);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [recentPlays, setRecentPlays] = useState<RecentPlay[]>([]);
  const [interactionCount, setInteractionCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nextMoodStats, nextAlertStats, nextSchedules, nextRecentPlays, nextInteractions, nextMessages] =
        await Promise.all([
          getMoodStats(undefined, 7),
          getAlertStats(),
          getFamilySchedules(),
          getRecentPlays(undefined, 20),
          getInteractionHistory(undefined, 120),
          getFamilyMessages(),
        ]);

      setMoodStats(nextMoodStats);
      setAlertStats(nextAlertStats);
      setSchedules(nextSchedules);
      setRecentPlays(nextRecentPlays);
      setInteractionCount(nextInteractions.list.length);
      setMessageCount(nextMessages.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : '周报加载失败';
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

  const todaySchedules = useMemo(() => schedules.filter((item) => isSameDay(item.schedule_time)), [schedules]);
  const completedToday = todaySchedules.filter((item) => item.status === 'completed').length;
  const completionRate = todaySchedules.length ? Math.round((completedToday / todaySchedules.length) * 100) : 0;
  const moodAverage = moodStats?.overall.avg_score ?? 0;
  const unresolvedAlerts = alertStats?.status_stats.unhandled ?? 0;

  const activity = useMemo(() => {
    const raw = [
      { label: '陪伴对话', value: interactionCount },
      { label: '回忆观看', value: recentPlays.length },
      { label: '家人留言', value: messageCount },
      { label: '护理任务', value: todaySchedules.length },
    ];
    const total = raw.reduce((sum, item) => sum + item.value, 0) || 1;
    return raw.map((item) => ({
      ...item,
      percent: Math.round((item.value / total) * 100),
    }));
  }, [interactionCount, recentPlays.length, messageCount, todaySchedules.length]);

  const highlights = useMemo(() => {
    const nextHighlights: string[] = [];

    if (moodAverage >= 7) {
      nextHighlights.push(`本周整体情绪均分 ${moodAverage.toFixed(1)}，整体偏稳。`);
    } else {
      nextHighlights.push(`本周整体情绪均分 ${moodAverage.toFixed(1)}，建议多联动服务端关注波动。`);
    }

    if (completionRate >= 80) {
      nextHighlights.push(`今日护理计划完成率 ${completionRate}%，照护执行比较稳定。`);
    } else {
      nextHighlights.push(`今日护理计划完成率 ${completionRate}%，仍有待补上的提醒任务。`);
    }

    if (recentPlays[0]) {
      nextHighlights.push(`最近播放最多被关注的内容是《${recentPlays[0].title}》。`);
    } else {
      nextHighlights.push('本周还没有新的媒体播放记录。');
    }

    if (unresolvedAlerts > 0) {
      nextHighlights.push(`当前还有 ${unresolvedAlerts} 条待处理通知，建议尽快查看。`);
    } else {
      nextHighlights.push('当前没有积压中的告警通知。');
    }

    return nextHighlights;
  }, [completionRate, moodAverage, recentPlays, unresolvedAlerts]);

  async function handleCopySummary() {
    const summary = [
      `家庭周报（${getWeekRangeLabel()}）`,
      `情绪均分：${moodAverage.toFixed(1)}`,
      `今日护理完成率：${completionRate}%`,
      `待处理通知：${unresolvedAlerts} 条`,
      `本周互动：${interactionCount} 次`,
      ...highlights.map((item, index) => `${index + 1}. ${item}`),
    ].join('\n');

    await Taro.setClipboardData({ data: summary });
    Taro.showToast({ title: '摘要已复制', icon: 'success' });
  }

  const metrics = [
    {
      label: '情绪状态',
      value: Math.round(moodAverage * 10),
      desc: moodAverage >= 7 ? '整体比较平稳' : '需要持续关注波动',
      tone: 'green',
    },
    {
      label: '护理完成',
      value: completionRate,
      desc: `${completedToday}/${todaySchedules.length || 0} 个今日任务已完成`,
      tone: 'blue',
    },
    {
      label: '通知处理',
      value: Math.max(0, 100 - unresolvedAlerts * 20),
      desc: unresolvedAlerts ? `还有 ${unresolvedAlerts} 条待处理通知` : '通知已经基本清空',
      tone: 'amber',
    },
  ] as const;

  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-sub-topbar'>
        <Text className='ff-back' onClick={() => Taro.redirectTo({ url: '/pages/family/dashboard/index' })}>‹</Text>
        <Text className='ff-sub-topbar__title'>健康周报</Text>
        <Text className='ff-sub-topbar__spacer'> </Text>
      </View>

      <View className='ff-stack ff-stack--page'>
        <View className='ff-report-hero'>
          <Text className='ff-kicker'>{getWeekRangeLabel()}</Text>
          <Text className='ff-hero__title'>{moodAverage >= 7 ? '本周整体状态良好' : '本周需要持续关注'}</Text>
          <Text className='ff-hero__subtitle'>
            {loading ? '正在同步家庭周报...' : highlights[0] || '系统会根据真实照护和互动数据汇总这里的摘要。'}
          </Text>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>核心指标</Text>
          <View className='ff-metric-list'>
            {metrics.map((item) => (
              <View className='ff-metric-row' key={item.label}>
                <View className='ff-metric-row__head'>
                  <Text>{item.label}</Text>
                  <Text>{item.value}分</Text>
                </View>
                <View className='ff-progress-track'>
                  <View className={`ff-progress-fill ff-progress-fill--${item.tone}`} style={{ width: `${Math.min(item.value, 100)}%` }} />
                </View>
                <Text className='ff-card-meta'>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>活动分布</Text>
          <View className='ff-distribution'>
            {activity.map((item) => (
              <View className='ff-distribution__row' key={item.label}>
                <Text>{item.label}</Text>
                <View className='ff-distribution__track'>
                  <View className='ff-distribution__fill ff-distribution__fill--blue' style={{ width: `${item.percent}%` }} />
                </View>
                <Text>{item.percent}%</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>本周重点</Text>
          <View className='ff-list'>
            {highlights.map((item, index) => (
              <View className='ff-highlight-row' key={`${index}-${item}`}>
                <Text>{index + 1}</Text>
                <Text>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <Button className='ff-download-button' onClick={() => void handleCopySummary()}>
          复制本周摘要
        </Button>
      </View>

      <BottomNav active='dashboard' />
    </View>
  );
}
