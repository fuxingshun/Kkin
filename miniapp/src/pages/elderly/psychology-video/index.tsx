import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Swiper, SwiperItem, Text, Video, View } from '@tarojs/components';
import {
  getPsychologyResources,
  getPsychologyVideoUrl,
  type PsychologyVideo,
} from '@/services/mentalHealth';

function getVideoId() {
  return Taro.getCurrentInstance().router?.params?.id;
}

function openCounselors(topic: string) {
  Taro.navigateTo({
    url: `/pages/elderly/counselor-list/index?filter=online&topic=${encodeURIComponent(topic)}`,
  });
}

function getInitialIndex(videos: PsychologyVideo[], videoId?: string) {
  const foundIndex = videos.findIndex((item) => item.slug === videoId || String(item.id) === videoId);
  return foundIndex >= 0 ? foundIndex : 0;
}

export default function ElderlyPsychologyVideoPage() {
  const [videos, setVideos] = useState<PsychologyVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const requestedVideoId = useMemo(() => getVideoId(), []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const resources = await getPsychologyResources();
      setVideos(resources.videos);
      setCurrentIndex(getInitialIndex(resources.videos, requestedVideoId));
    } catch (error) {
      const message = error instanceof Error ? error.message : '视频加载失败';
      Taro.showToast({ title: message, icon: 'none' });
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [requestedVideoId]);

  useDidShow(() => {
    void loadData();
  });

  function getVideoSrc(item: PsychologyVideo) {
    return getPsychologyVideoUrl(item.slug);
  }

  function handleVideoError() {
    Taro.showToast({ title: '视频加载失败，请检查数据库中的视频来源', icon: 'none' });
  }

  async function copySourceUrl(item: PsychologyVideo) {
    await Taro.setClipboardData({ data: item.source_url });
    Taro.showToast({ title: '来源链接已复制', icon: 'success' });
  }

  if (!videos.length) {
    return (
      <View className='pc-reels-page'>
        <View className='pc-reels-stage'>
          <View className='pc-reels-topbar'>
            <Button className='pc-reels-back' onClick={() => Taro.navigateBack()}>
              返回
            </Button>
          </View>
          <View className='pc-reels-caption'>
            <Text className='pc-reels-title'>{loading ? '正在同步视频' : '暂无心理科普视频'}</Text>
            <Text className='pc-reels-desc'>请在数据库 psychology_videos 表中维护视频内容。</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className='pc-reels-page'>
      <Swiper
        className='pc-reels-swiper'
        vertical
        current={currentIndex}
        circular={videos.length > 1}
        onChange={(event) => setCurrentIndex(event.detail.current)}
      >
        {videos.map((item, index) => (
          <SwiperItem className='pc-reels-slide' key={item.slug}>
            <View className='pc-reels-stage'>
              <Video
                id={`psychology-video-${item.slug}`}
                className='pc-reels-video'
                src={index === currentIndex ? getVideoSrc(item) : ''}
                title={item.title}
                autoplay={index === currentIndex}
                loop
                controls={false}
                objectFit='cover'
                showCenterPlayBtn
                showFullscreenBtn={false}
                onError={handleVideoError}
              />

              <View className='pc-reels-topbar'>
                <Button className='pc-reels-back' onClick={() => Taro.navigateBack()}>
                  返回
                </Button>
                <Text className='pc-reels-counter'>{index + 1}/{videos.length}</Text>
              </View>

              <View className='pc-reels-side'>
                <Button className='pc-reels-action' onClick={() => openCounselors(item.category || item.title)}>
                  咨询
                </Button>
                <Button className='pc-reels-action pc-reels-action--ghost' onClick={() => void copySourceUrl(item)}>
                  来源
                </Button>
              </View>

              <View className='pc-reels-caption'>
                <Text className='pc-reels-tag'>{item.category || '心理健康'} · {item.duration || '视频讲解'}</Text>
                <Text className='pc-reels-title'>{item.title}</Text>
                <Text className='pc-reels-desc'>{item.summary || ''}</Text>
                <View className='pc-reels-takeaways'>
                  {(item.takeaways || []).slice(0, 2).map((takeaway) => (
                    <Text className='pc-reels-takeaway' key={takeaway}>
                      {takeaway}
                    </Text>
                  ))}
                </View>
                <Text className='pc-reels-hint'>上下滑动切换视频</Text>
              </View>
            </View>
          </SwiperItem>
        ))}
      </Swiper>
    </View>
  );
}
