import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { getMoodRecords, moodLabelMap, type MoodRecord } from '@/services/elderly';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';
import { formatDateTimeText } from '@/utils/format';
import { getElderlySession } from '@/utils/session';

export default function ElderlyRecordHistoryPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const { familyId, elderlyId } = getElderlySession();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<MoodRecord[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const nextRecords = await getMoodRecords(familyId, elderlyId, 30);
      setRecords(nextRecords);
    } catch (error) {
      const message = error instanceof Error ? error.message : '记录加载失败';
      Taro.showToast({ title: message, icon: 'none' });
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

  const averageScore = useMemo(() => {
    if (!records.length) {
      return 0;
    }

    return records.reduce((total, item) => total + (item.mood_score || 0), 0) / records.length;
  }, [records]);

  return (
    <View className={`ef-page ef-page--sub ${preferenceClassName}`}>
      <View className='ef-content-pad'>
        <View className='ef-page-head'>
          <Text className='ef-page-head__title'>历史情绪记录</Text>
          <Text className='ef-page-head__desc'>按时间查看最近的情绪、评分和补充备注，便于持续回顾变化。</Text>
        </View>

        <View className='ef-panel'>
          <Text className='ef-section-title'>最近 30 条概览</Text>
          <View className='ef-trend-list'>
            <View className='ef-trend-row'>
              <Text>记录总数</Text>
              <Text>{records.length} 次</Text>
            </View>
            <View className='ef-trend-row'>
              <Text>平均情绪分</Text>
              <Text>{records.length ? averageScore.toFixed(1) : '--'}</Text>
            </View>
            <View className='ef-trend-row'>
              <Text>最近一次记录</Text>
              <Text>{records[0]?.recorded_at ? '已同步' : '暂无'}</Text>
            </View>
          </View>
        </View>

        <View className='ef-list' style={{ marginTop: '24rpx' }}>
          {records.length ? (
            records.map((record, index) => (
              <View className='ef-history-card' key={`${record.id || record.created_at || index}`}>
                <View className='ef-history-head'>
                  <View className='ef-history-icon'>{moodLabelMap[record.mood_type]?.slice(0, 1) || '情'}</View>
                  <View>
                    <View className='ef-inline'>
                      <Text className='ef-card-title'>{moodLabelMap[record.mood_type] || record.mood_type}</Text>
                      <Text className='ef-done-badge'>评分 {record.mood_score || '--'}</Text>
                    </View>
                    <Text className='ef-muted'>
                      {formatDateTimeText(record.recorded_at || record.created_at || '') || '刚刚记录'}
                    </Text>
                  </View>
                </View>
                <View className='ef-specialty'>
                  <Text>{record.note?.trim() || '当天未填写补充说明。'}</Text>
                </View>
              </View>
            ))
          ) : (
            <View className='ef-history-card'>
              <Text className='ef-card-title'>还没有历史记录</Text>
              <Text className='ef-card-text'>{loading ? '正在同步情绪记录...' : '先完成今天的情绪记录，这里会自动累计。'}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
