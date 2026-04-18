import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Image, Text, Video, View } from '@tarojs/components';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import {
  getMediaUrl,
  getRecommendedMedia,
  getThumbnailUrl,
  moodLabelMap,
  recordMediaPlay,
  submitMediaFeedback,
  type MoodType,
  type RecommendedMedia,
} from '@/services/elderly';
import { getElderlySession } from '@/utils/session';

type FeedbackType = 'like' | 'dislike';

function parseMediaId(value?: string) {
  const mediaId = Number(value);
  return Number.isFinite(mediaId) ? mediaId : null;
}

export default function ElderlyMediaPage() {
  const { familyId, elderlyId, elderName } = getElderlySession();
  const [loading, setLoading] = useState(true);
  const [mediaList, setMediaList] = useState<RecommendedMedia[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentMood, setCurrentMood] = useState<MoodType | undefined>(undefined);
  const [feedbackById, setFeedbackById] = useState<Record<number, FeedbackType>>({});
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState<FeedbackType | null>(null);

  const currentMedia = mediaList[currentIndex] || null;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const params = Taro.getCurrentInstance().router?.params || {};
      const initialMediaId = parseMediaId(params.mediaId);
      const initialMood = params.mood as MoodType | undefined;

      setCurrentMood(initialMood);

      const recommendedMedia = await getRecommendedMedia(familyId, elderlyId, initialMood);
      setMediaList(recommendedMedia);

      if (!recommendedMedia.length) {
        setCurrentIndex(0);
        return;
      }

      const foundIndex = initialMediaId
        ? recommendedMedia.findIndex((item) => item.id === initialMediaId)
        : -1;
      const nextIndex = foundIndex >= 0 ? foundIndex : 0;

      setCurrentIndex(nextIndex);
      await recordMediaPlay(recommendedMedia[nextIndex].id, elderlyId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
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

  const currentTags = useMemo(() => currentMedia?.tags?.filter(Boolean) || [], [currentMedia]);

  async function switchToIndex(nextIndex: number) {
    if (!mediaList[nextIndex]) {
      return;
    }

    try {
      setCurrentIndex(nextIndex);
      await recordMediaPlay(mediaList[nextIndex].id, elderlyId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '切换失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  async function handleFeedback(type: FeedbackType) {
    if (!currentMedia || feedbackBusy) {
      return;
    }

    try {
      setFeedbackBusy(true);
      setPendingFeedback(type);
      await submitMediaFeedback(currentMedia.id, type, elderlyId);
      setFeedbackById((prev) => ({
        ...prev,
        [currentMedia.id]: type,
      }));
      Taro.showToast({
        title: type === 'like' ? '已记下喜欢' : '已记下不喜欢',
        icon: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '提交失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setFeedbackBusy(false);
      setPendingFeedback(null);
    }
  }

  return (
    <View className='ke-page ke-page--compact'>
      <View className='ke-hero'>
        <Text className='ke-eyebrow'>Memory Player</Text>
        <Text className='ke-title'>{elderName}的回忆播放页</Text>
        <Text className='ke-subtitle'>
          把首页推荐的照片和视频放进一个更容易专注观看的页面里，也顺手把喜欢与不喜欢反馈记下来。
        </Text>
        <View className='ke-chip-row' style={{ marginTop: '22rpx' }}>
          <Text className='ke-chip ke-chip--warm'>当前内容 {currentMedia ? `${currentIndex + 1} / ${mediaList.length}` : '待加载'}</Text>
          <Text className='ke-chip'>筛选心情 {currentMood ? moodLabelMap[currentMood] : '未指定'}</Text>
        </View>
      </View>

      {currentMedia ? (
        <>
          <SectionCard
            title='当前播放'
            caption={currentMedia.media_type === 'video' ? '视频可直接播放' : '图片可直接查看'}
            extra={
              <Text
                className='ke-section-caption'
                onClick={() => Taro.navigateTo({ url: '/pages/elderly/media-history/index' })}
              >
                查看历史
              </Text>
            }
          >
            <View className='ke-player'>
              <View className='ke-player__stage'>
                {currentMedia.media_type === 'video' ? (
                  <Video
                    className='ke-player__video'
                    src={getMediaUrl(currentMedia.file_path)}
                    poster={currentMedia.thumbnail_path ? getThumbnailUrl(currentMedia.thumbnail_path) : undefined}
                    controls
                    autoplay
                    objectFit='contain'
                    showCenterPlayBtn
                    onEnded={() => {
                      const nextIndex = (currentIndex + 1) % mediaList.length;
                      void switchToIndex(nextIndex);
                    }}
                  />
                ) : (
                  <Image
                    className='ke-player__image'
                    mode='aspectFit'
                    src={getMediaUrl(currentMedia.file_path)}
                  />
                )}
              </View>

              <View className='ke-player__body'>
                <Text className='ke-card__title'>{currentMedia.title}</Text>
                <View className='ke-card__meta'>
                  <Text>{currentMedia.media_type === 'video' ? '视频内容' : '照片内容'}</Text>
                  <Text>推荐播放 {currentMedia.play_count}</Text>
                  {currentMedia.priority ? <Text>优先级 {currentMedia.priority}</Text> : null}
                </View>
                {currentMedia.description ? (
                  <Text className='ke-card__body'>{currentMedia.description}</Text>
                ) : (
                  <Text className='ke-card__body'>这条回忆内容还没有补充说明。</Text>
                )}
                {currentTags.length ? (
                  <View className='ke-chip-row' style={{ marginTop: '18rpx' }}>
                    {currentTags.map((tag) => (
                      <Text className='ke-chip' key={tag}>
                        {tag}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </SectionCard>

          <SectionCard title='播放操作' caption='可以切换内容，也可以告诉系统喜不喜欢'>
            <View className='ke-grid-2'>
              <Button
                className='ke-button--ghost'
                disabled={mediaList.length <= 1}
                onClick={() => {
                  const prevIndex = currentIndex === 0 ? mediaList.length - 1 : currentIndex - 1;
                  void switchToIndex(prevIndex);
                }}
              >
                上一个
              </Button>
              <Button
                className='ke-button'
                disabled={mediaList.length <= 1}
                onClick={() => {
                  const nextIndex = (currentIndex + 1) % mediaList.length;
                  void switchToIndex(nextIndex);
                }}
              >
                下一个
              </Button>
              <Button
                className={feedbackById[currentMedia.id] === 'like' ? 'ke-button' : 'ke-button--ghost'}
                loading={feedbackBusy && pendingFeedback === 'like'}
                onClick={() => {
                  void handleFeedback('like');
                }}
              >
                喜欢
              </Button>
              <Button
                className={feedbackById[currentMedia.id] === 'dislike' ? 'ke-button--danger' : 'ke-button--ghost'}
                loading={feedbackBusy && pendingFeedback === 'dislike'}
                onClick={() => {
                  void handleFeedback('dislike');
                }}
              >
                不喜欢
              </Button>
            </View>
            <Text className='ke-footnote'>
              当前反馈：{feedbackById[currentMedia.id] === 'like'
                ? '已标记喜欢'
                : feedbackById[currentMedia.id] === 'dislike'
                  ? '已标记不喜欢'
                  : '还没有提交反馈'}
            </Text>
          </SectionCard>

          <SectionCard title='推荐列表' caption='也可以直接切到其他内容'>
            <View className='ke-card-list'>
              {mediaList.map((item, index) => (
                <View
                  className='ke-card ke-media'
                  key={item.id}
                  onClick={() => {
                    if (index !== currentIndex) {
                      void switchToIndex(index);
                    }
                  }}
                  style={{
                    background:
                      index === currentIndex
                        ? 'linear-gradient(135deg, rgba(217, 107, 59, 0.12), rgba(255, 251, 247, 0.98))'
                        : undefined,
                  }}
                >
                  <View className='ke-media__thumb'>
                    <Image
                      className='ke-media__thumb-img'
                      mode='aspectFill'
                      src={item.thumbnail_path ? getThumbnailUrl(item.thumbnail_path) : getMediaUrl(item.file_path)}
                    />
                  </View>
                  <View>
                    <Text className='ke-card__title'>{item.title}</Text>
                    <View className='ke-card__meta'>
                      <Text>{item.media_type === 'video' ? '视频' : '照片'}</Text>
                      <Text>{index === currentIndex ? '正在查看' : '点击切换'}</Text>
                    </View>
                    {item.description ? <Text className='ke-card__body'>{item.description}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </SectionCard>
        </>
      ) : (
        <SectionCard title='推荐内容' caption='老人端首页推荐为空时，这里也会同步为空'>
          <EmptyState title='暂时没有推荐内容' hint='请先在家属端上传照片或视频，或者稍后再从首页重新进入。' />
        </SectionCard>
      )}

      {loading ? <Text className='ke-footnote'>正在准备回忆内容...</Text> : null}
    </View>
  );
}
