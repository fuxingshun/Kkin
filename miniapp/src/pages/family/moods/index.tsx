import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';
import { getMoodStats, moodLabelMap, queryFamilyMoodRecords, type MoodRecord, type MoodStatsResponse } from '@/services/family';
import { formatDateTimeText } from '@/utils/format';

const dayOptions = [7, 30] as const;

function getShortDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getMoodInsight(score: number) {
  if (score >= 8) return '整体情绪很好，陪伴内容接受度高';
  if (score >= 6) return '整体平稳，建议继续保持节奏';
  if (score >= 4) return '最近有波动，建议多看触发原因';
  return '情绪偏低，建议尽快联动服务端跟进';
}

export default function FamilyMoodsPage() {
  const [days, setDays] = useState<(typeof dayOptions)[number]>(7);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MoodStatsResponse | null>(null);
  const [records, setRecords] = useState<MoodRecord[]>([]);

  const loadData = useCallback(async (daysValue = days) => {
    try {
      setLoading(true);
      const [nextStats, nextRecords] = await Promise.all([
        getMoodStats(undefined, daysValue),
        queryFamilyMoodRecords(undefined, { limit: daysValue === 7 ? 12 : 30 }),
      ]);
      setStats(nextStats);
      setRecords(nextRecords);
    } catch (error) {
      const message = error instanceof Error ? error.message : '情绪数据加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, [days]);

  useDidShow(() => {
    void loadData(days);
  });

  usePullDownRefresh(() => {
    void loadData(days);
  });

  const totalMoodCount = stats?.mood_type_stats.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const trend = useMemo(() => stats?.daily_stats.slice().reverse() ?? [], [stats]);
  const averageScore = stats?.overall.avg_score ?? 0;

  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-sub-topbar'>
        <Text className='ff-back' onClick={() => Taro.redirectTo({ url: '/pages/family/dashboard/index' })}>‹</Text>
        <Text className='ff-sub-topbar__title'>情绪历史</Text>
        <Text className='ff-sub-topbar__spacer'> </Text>
      </View>

      <View className='ff-stack ff-stack--page'>
        <View className='ff-overview-card'>
          <View>
            <Text className='ff-kicker'>最近 {days} 天情绪概览</Text>
            <Text className='ff-score'>{averageScore.toFixed(1)}</Text>
            <Text className='ff-hero__subtitle'>{getMoodInsight(averageScore)}</Text>
          </View>
          <View className='ff-avatar ff-avatar--glass'>
            <Text>绪</Text>
          </View>
        </View>

        <View className='ff-tab-strip ff-tab-strip--card'>
          {dayOptions.map((item) => (
            <Text
              key={item}
              className={`ff-tab ${item === days ? 'ff-tab--green' : ''}`}
              onClick={() => {
                setDays(item);
                void loadData(item);
              }}
            >
              最近 {item} 天
            </Text>
          ))}
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>近 {days} 天情绪走势</Text>
          <View className='ff-line-chart ff-line-chart--large'>
            {trend.length ? (
              trend.map((item) => (
                <View className='ff-line-chart__item' key={item.date}>
                  <View className='ff-line-chart__track'>
                    <View className='ff-line-chart__bar' style={{ height: `${Math.max(item.avg_score * 10, 12)}%` }} />
                  </View>
                  <Text>{getShortDateLabel(item.date)}</Text>
                </View>
              ))
            ) : (
              <View className='ff-record-row'>
                <Text>{loading ? '正在同步情绪趋势...' : '还没有情绪记录'}</Text>
              </View>
            )}
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>情绪分布</Text>
          <View className='ff-distribution'>
            {(stats?.mood_type_stats || []).map((item) => {
              const percent = totalMoodCount ? Math.round((item.count / totalMoodCount) * 100) : 0;
              return (
                <View className='ff-distribution__row' key={item.mood_type}>
                  <Text>{moodLabelMap[item.mood_type]}</Text>
                  <View className='ff-distribution__track'>
                    <View className='ff-distribution__fill ff-distribution__fill--green' style={{ width: `${percent}%` }} />
                  </View>
                  <Text>{percent}%</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View className='ff-card'>
          <View className='ff-section-head'>
            <Text className='ff-section-title'>情绪记录</Text>
            <Text className='ff-green-link'>共 {stats?.overall.total_records ?? records.length} 条</Text>
          </View>
          <View className='ff-list'>
            {records.length ? (
              records.map((item, index) => (
                <View className='ff-record-row' key={`${item.id || item.recorded_at}-${index}`}>
                  <View className='ff-record-row__date'>
                    <Text>{item.recorded_at ? formatDateTimeText(item.recorded_at) : '待同步'}</Text>
                    <Text>{item.mood_score} 分</Text>
                  </View>
                  <View className='ff-record-row__body'>
                    <Text>{moodLabelMap[item.mood_type]}</Text>
                    <Text>{item.note || '本次记录没有备注说明。'}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View className='ff-record-row'>
                <Text>{loading ? '正在同步情绪记录...' : '还没有情绪记录'}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <BottomNav active='dashboard' />
    </View>
  );
}
