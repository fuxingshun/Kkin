import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Image, Text, Video, View } from '@tarojs/components';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';
import { DEFAULT_ELDERLY_ID, DEFAULT_FAMILY_ID } from '@/config/runtime';
import {
  getMediaUrl,
  getRecommendedMedia,
  getThumbnailUrl,
  recordMediaPlay,
  submitMediaFeedback,
  type RecommendedMedia,
} from '@/services/elderly';
import { formatRelativeTime } from '@/utils/format';

export default function ElderlyMemoriesPage() {
  const [mediaList, setMediaList] = useState<RecommendedMedia[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState('全部回忆');
  const [feedbackById, setFeedbackById] = useState<Record<number, 'like' | 'dislike'>>({});

  const loadData = useCallback(async () => {
    try {
      const list = await getRecommendedMedia(DEFAULT_FAMILY_ID, DEFAULT_ELDERLY_ID);
      setMediaList(list);
      setCurrentIndex((index) => (list[index] ? index : 0));
      if (list[0]) {
        await recordMediaPlay(list[0].id, DEFAULT_ELDERLY_ID);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  const categories = useMemo(() => {
    const tagCounts = new Map<string, number>();
    mediaList.forEach((item) => {
      (item.tags || []).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return [
      { name: '全部回忆', count: mediaList.length },
      { name: '照片', count: mediaList.filter((item) => item.media_type === 'photo').length },
      { name: '视频', count: mediaList.filter((item) => item.media_type === 'video').length },
      ...Array.from(tagCounts.entries()).slice(0, 3).map(([name, count]) => ({ name, count })),
    ];
  }, [mediaList]);

  const filteredList = useMemo(() => {
    if (activeCategory === '全部回忆') return mediaList;
    if (activeCategory === '照片') return mediaList.filter((item) => item.media_type === 'photo');
    if (activeCategory === '视频') return mediaList.filter((item) => item.media_type === 'video');
    return mediaList.filter((item) => item.tags?.includes(activeCategory));
  }, [activeCategory, mediaList]);

  const currentMemory = filteredList[currentIndex] || filteredList[0] || null;

  async function switchToIndex(nextIndex: number) {
    const next = filteredList[nextIndex];
    if (!next) return;
    setCurrentIndex(nextIndex);
    try {
      await recordMediaPlay(next.id, DEFAULT_ELDERLY_ID);
    } catch {
      // 播放记录失败不打断老人查看内容。
    }
  }

  async function handleLike() {
    if (!currentMemory) return;
    try {
      await submitMediaFeedback(currentMemory.id, 'like', DEFAULT_ELDERLY_ID);
      setFeedbackById((prev) => ({ ...prev, [currentMemory.id]: 'like' }));
      Taro.showToast({ title: '已记下喜欢', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '提交失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  return (
    <View className='ef-page ef-page--tab'>
      <View className='ef-page-head'>
        <Text className='ef-page-head__title'>回忆播放</Text>
        <Text className='ef-page-head__desc'>看看家人为您准备的美好回忆</Text>
      </View>

      <View className='ef-memory-player'>
        <View className='ef-memory-player__stage'>
          {currentMemory ? (
            currentMemory.media_type === 'video' ? (
              <Video
                className='ef-memory-player__video'
                src={getMediaUrl(currentMemory.file_path)}
                poster={currentMemory.thumbnail_path ? getThumbnailUrl(currentMemory.thumbnail_path) : undefined}
                controls
                objectFit='contain'
              />
            ) : (
              <Image
                className='ef-memory-player__image'
                mode='aspectFit'
                src={getMediaUrl(currentMemory.file_path)}
              />
            )
          ) : (
            <View className='ef-stage-center'>
              <View className='ef-stage-icon'>
                <Text>忆</Text>
              </View>
              <Text>家人上传照片或视频后会显示在这里</Text>
            </View>
          )}
          {filteredList.length > 1 ? (
            <>
              <Button
                className='ef-stage-nav ef-stage-nav--left'
                onClick={() => switchToIndex(currentIndex > 0 ? currentIndex - 1 : filteredList.length - 1)}
              >
                〈
              </Button>
              <Button
                className='ef-stage-nav ef-stage-nav--right'
                onClick={() => switchToIndex(currentIndex < filteredList.length - 1 ? currentIndex + 1 : 0)}
              >
                〉
              </Button>
            </>
          ) : null}
          <Button className='ef-stage-play'>播</Button>
          <Text className='ef-stage-count'>{currentMemory ? `${currentIndex + 1} / ${filteredList.length}` : '0 / 0'}</Text>
        </View>
        <View className='ef-memory-info'>
          <View className='ef-memory-info__main'>
            <Text className='ef-page-head__title'>{currentMemory?.title || '暂无回忆内容'}</Text>
            <Text className='ef-card-text'>{currentMemory?.description || '请先在家属端上传照片或视频。'}</Text>
            <Text className='ef-muted'>{currentMemory ? `${currentMemory.media_type === 'video' ? '视频' : '照片'} · ${formatRelativeTime(currentMemory.last_played_at || currentMemory.created_at || '')}` : '数据库暂无内容'}</Text>
          </View>
          <View className={`ef-like ${currentMemory && feedbackById[currentMemory.id] === 'like' ? 'ef-like--active' : ''}`} onClick={handleLike}>
            <Text>心</Text>
          </View>
        </View>
        <View className='ef-two-actions'>
          <Button className='ef-blue-button' onClick={() => switchToIndex((currentIndex + 1) % Math.max(filteredList.length, 1))}>自动播放</Button>
          <Button className='ef-soft-button' onClick={() => Taro.showToast({ title: '已同步播放记录', icon: 'none' })}>语音讲述</Button>
        </View>
      </View>

      <View className='ef-content-pad'>
        <Text className='ef-section-title'>回忆专题</Text>
        <View className='ef-category-grid'>
          {categories.map((category) => (
            <View
              key={category.name}
              className={`ef-category ${activeCategory === category.name ? 'ef-category--active' : ''}`}
              onClick={() => {
                setActiveCategory(category.name);
                setCurrentIndex(0);
              }}
            >
              <Text className='ef-category__name'>{category.name}</Text>
              <Text className='ef-category__count'>{category.count} 个回忆</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='ef-content-pad'>
        <Text className='ef-section-title'>更多推荐</Text>
        <View className='ef-list'>
          {filteredList.slice(0, 3).map((item, index) => (
            <View className='ef-media-row' key={item.id} onClick={() => switchToIndex(index)}>
              <View className='ef-media-row__thumb'>
                <Text>{item.media_type === 'video' ? '视' : '照'}</Text>
              </View>
              <View className='ef-media-row__body'>
                <Text className='ef-card-title'>{item.title}</Text>
                <Text className='ef-card-text'>{item.media_type === 'video' ? '视频' : '照片'} · 点击播放</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <ElderlyTabBar active='memories' />
    </View>
  );
}
