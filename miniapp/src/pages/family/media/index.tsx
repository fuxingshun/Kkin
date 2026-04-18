import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Image, Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';
import { DEFAULT_FAMILY_ID } from '@/config/runtime';
import {
  getFamilyMedia,
  getMediaUrl,
  getThumbnailUrl,
  uploadMedia,
  type Media,
} from '@/services/family';

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'photo', label: '图片' },
  { key: 'video', label: '视频' },
] as const;

type MediaTab = (typeof tabs)[number]['key'];

export default function FamilyMediaPage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [activeTab, setActiveTab] = useState<MediaTab>('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const nextMedia = await getFamilyMedia();
      setMediaList(nextMedia);
    } catch (error) {
      const message = error instanceof Error ? error.message : '回忆内容加载失败';
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

  const visibleMedia = useMemo(
    () => mediaList.filter((item) => activeTab === 'all' || item.media_type === activeTab),
    [mediaList, activeTab]
  );

  async function handleUpload() {
    try {
      const chooser = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image', 'video'],
      });

      const target = chooser.tempFiles?.[0];
      if (!target?.tempFilePath) {
        return;
      }

      const modal = await Taro.showModal({
        title: '内容标题',
        editable: true,
        placeholderText: '例如：小米生日视频',
      } as any);

      if (!modal.confirm) {
        return;
      }

      const inputValue = (modal as { content?: string }).content?.trim();
      const fallbackTitle = target.fileType === 'video' ? '新视频回忆' : '新照片回忆';

      setUploading(true);
      await uploadMedia({
        filePath: target.tempFilePath,
        family_id: DEFAULT_FAMILY_ID,
        title: inputValue || fallbackTitle,
      });
      Taro.showToast({ title: '上传成功', icon: 'success' });
      await loadData();
    } catch (error) {
      if (error && typeof error === 'object' && 'errMsg' in error && String((error as { errMsg: string }).errMsg).includes('cancel')) {
        return;
      }
      const message = error instanceof Error ? error.message : '上传失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-sub-topbar ff-sub-topbar--green'>
        <Text className='ff-back' onClick={() => Taro.redirectTo({ url: '/pages/family/dashboard/index' })}>‹</Text>
        <Text className='ff-sub-topbar__title'>回忆内容</Text>
        <Text className='ff-sub-topbar__spacer'> </Text>
      </View>

      <View className='ff-hero ff-hero--green ff-hero--memory'>
        <View>
          <Text className='ff-kicker'>回忆库</Text>
          <Text className='ff-hero__title'>把熟悉的人和事放在这里</Text>
          <Text className='ff-hero__subtitle'>老人端会根据情绪和时间窗口，优先播放这里维护的内容</Text>
        </View>
        <View className='ff-stat-grid'>
          <View className='ff-hero-stat'>
            <Text>{mediaList.length}</Text>
            <Text>内容总数</Text>
          </View>
          <View className='ff-hero-stat'>
            <Text>{mediaList.filter((item) => item.media_type === 'photo').length}</Text>
            <Text>图片</Text>
          </View>
          <View className='ff-hero-stat'>
            <Text>{mediaList.filter((item) => item.media_type === 'video').length}</Text>
            <Text>视频</Text>
          </View>
        </View>
      </View>

      <View className='ff-stack ff-stack--overlap'>
        <View className='ff-tab-strip ff-tab-strip--card'>
          {tabs.map((tab) => (
            <Text
              key={tab.key}
              className={`ff-tab ${tab.key === activeTab ? 'ff-tab--green' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Text>
          ))}
        </View>

        <Button className='ff-new-button' loading={uploading} onClick={() => void handleUpload()}>
          上传新内容
        </Button>

        <View className='ff-memory-grid'>
          {visibleMedia.length ? (
            visibleMedia.map((item) => (
              <View
                className='ff-memory-card'
                key={item.id}
                onClick={() => Taro.navigateTo({ url: `/pages/family/media-detail/index?mediaId=${item.id}` })}
              >
                <View className='ff-memory-card__cover'>
                  <Image
                    className='ke-media__thumb-img'
                    mode='aspectFill'
                    src={item.thumbnail_path ? getThumbnailUrl(item.thumbnail_path) : getMediaUrl(item.file_path)}
                  />
                </View>
                <View className='ff-memory-card__body'>
                  <Text>{item.title}</Text>
                  <Text>{item.media_type === 'video' ? '视频' : '图片'} · 已播放 {item.play_count} 次</Text>
                </View>
              </View>
            ))
          ) : (
            <View className='ff-card'>
              <Text className='ff-section-title'>当前分类下还没有内容</Text>
              <Text className='ff-card-subtitle'>
                {loading ? '正在同步回忆库...' : '可以先上传照片或视频，随后到详情里补标签和推荐策略。'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <BottomNav active='dashboard' />
    </View>
  );
}
