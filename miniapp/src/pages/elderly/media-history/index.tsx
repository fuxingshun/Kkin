import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Image, Text, View } from '@tarojs/components';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { getMediaHistory, getMediaUrl, getThumbnailUrl, type MediaHistoryEntry } from '@/services/elderly';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';
import { formatDateTimeText, formatDurationSeconds } from '@/utils/format';
import { getElderlySession } from '@/utils/session';

function getFeedbackLabel(feedbackType?: MediaHistoryEntry['feedback_type']) {
  if (feedbackType === 'like') {
    return '喜欢';
  }

  if (feedbackType === 'dislike') {
    return '不喜欢';
  }

  return '未反馈';
}

export default function ElderlyMediaHistoryPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const { elderlyId, elderName } = getElderlySession();
  const [loading, setLoading] = useState(true);
  const [historyList, setHistoryList] = useState<MediaHistoryEntry[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const history = await getMediaHistory(elderlyId, 30);
      setHistoryList(history);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, [elderlyId]);

  useDidShow(() => {
    void loadData();
  });

  usePullDownRefresh(() => {
    void loadData();
  });

  const summary = useMemo(() => {
    return historyList.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.feedback_type === 'like') acc.likes += 1;
        if (item.feedback_type === 'dislike') acc.dislikes += 1;
        if (item.media_type === 'video') acc.videos += 1;
        if (item.media_type === 'photo') acc.photos += 1;
        return acc;
      },
      { total: 0, likes: 0, dislikes: 0, videos: 0, photos: 0 }
    );
  }, [historyList]);

  return (
    <View className={`ke-page ke-page--compact ${preferenceClassName}`}>
      <View className='ke-hero'>
        <Text className='ke-eyebrow'>Viewing History</Text>
        <Text className='ke-title'>{elderName}最近看过什么</Text>
        <Text className='ke-subtitle'>
          这页会把最近看过的照片和视频整理出来，方便老人回看，也方便家属确认哪些内容更容易被接受。
        </Text>
        <View className='ke-chip-row' style={{ marginTop: '22rpx' }}>
          <Text className='ke-chip ke-chip--warm'>最近记录 {summary.total}</Text>
          <Text className='ke-chip'>喜欢 {summary.likes}</Text>
          <Text className='ke-chip'>视频 {summary.videos}</Text>
          <Text className='ke-chip'>照片 {summary.photos}</Text>
        </View>
      </View>

      <SectionCard title='回看记录' caption='默认展示最近 30 条播放历史'>
        {historyList.length ? (
          <View className='ke-card-list'>
            {historyList.map((item) => (
              <View className='ke-card ke-media' key={item.id}>
                <View className='ke-media__thumb'>
                  <Image
                    className='ke-media__thumb-img'
                    mode='aspectFill'
                    src={
                      item.media_type === 'video' && item.thumbnail_path
                        ? getThumbnailUrl(item.thumbnail_path)
                        : getMediaUrl(item.file_path)
                    }
                  />
                </View>
                <View>
                  <Text className='ke-card__title'>{item.title}</Text>
                  <View className='ke-card__meta'>
                    <Text>{item.media_type === 'video' ? '视频' : '照片'}</Text>
                    <Text>{formatDateTimeText(item.played_at)}</Text>
                  </View>
                  <Text className='ke-card__body'>
                    观看时长 {formatDurationSeconds(item.duration_watched)}，{item.completed ? '已完整看完' : '中途结束'}。
                  </Text>
                  <View className='ke-chip-row' style={{ marginTop: '14rpx' }}>
                    <Text className='ke-chip'>{getFeedbackLabel(item.feedback_type)}</Text>
                    {item.mood_before ? <Text className='ke-chip'>播放前 {item.mood_before}</Text> : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title='还没有观看历史' hint='等老人端开始播放照片或视频后，这里就会按时间积累下来。' />
        )}
      </SectionCard>

      {loading ? <Text className='ke-footnote'>正在同步观看历史...</Text> : null}
    </View>
  );
}
