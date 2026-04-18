import React, { useState, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, X, Grid3x3, Volume2, VolumeX, Pause, Play, Tag } from 'lucide-react';
import * as mediaService from '../services/mediaService';
import { MediaLibraryGrid } from './MediaLibraryGrid';

interface MediaPlayerProps {
  familyId: string;
  elderlyId: number;
  currentMood?: string;
  onClose?: () => void;
}

/**
 * 老人端媒体播放器组件
 * 自动获取推荐媒体并播放，支持点赞/点踩反馈
 */
export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  familyId,
  elderlyId,
  currentMood,
  onClose,
}) => {
  const [recommendedMedia, setRecommendedMedia] = useState<mediaService.RecommendedMedia[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [playStartTime, setPlayStartTime] = useState<Date | null>(null);
  const [hasGivenFeedback, setHasGivenFeedback] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // 默认静音以支持自动播放
  const [isPaused, setIsPaused] = useState(false); // 是否暂停自动切换
  const [showTagFilter, setShowTagFilter] = useState(false); // 是否显示标签筛选
  const [availableTags, setAvailableTags] = useState<string[]>([]); // 可用标签
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // 已选标签
  const videoRef = useRef<HTMLVideoElement>(null);

  // 加载推荐媒体
  useEffect(() => {
    loadRecommendedMedia();
  }, [familyId, elderlyId, currentMood, selectedTags]);

  // 记录播放开始时间
  useEffect(() => {
    if (currentMedia) {
      setPlayStartTime(new Date());
      setHasGivenFeedback(false);
    }
  }, [currentIndex]);

  const loadRecommendedMedia = async () => {
    try {
      setLoading(true);
      const response = await mediaService.getRecommendedMedia(
        familyId,
        elderlyId,
        currentMood,
        undefined,
        selectedTags.length > 0 ? selectedTags : undefined
      );
      setRecommendedMedia(response.media);
      // 只在首次加载时设置可用标签（避免筛选后标签列表变化）
      if (availableTags.length === 0 && response.available_tags.length > 0) {
        setAvailableTags(response.available_tags);
      }
      setCurrentIndex(0); // 重置到第一个
      // 如果有媒体，记录第一个的播放
      if (response.media.length > 0) {
        recordPlayStart(response.media[0].id);
      }
    } catch (error) {
      console.error('加载推荐媒体失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 切换标签选择
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // 清除所有标签筛选
  const clearTagFilter = () => {
    setSelectedTags([]);
  };

  // 记录播放开始（不等待完成）
  const recordPlayStart = async (mediaId: number) => {
    try {
      await mediaService.recordMediaPlay(mediaId, {
        elderly_id: elderlyId,
        duration_watched: 0,
        completed: 0,
        triggered_by: 'auto',
        mood_before: currentMood,
      });
      console.log('播放记录已创建, mediaId:', mediaId);
    } catch (error) {
      console.error('记录播放开始失败:', error);
    }
  };

  const currentMedia = recommendedMedia[currentIndex];

  // 记录播放
  const recordPlay = async (completed: boolean = false) => {
    if (!currentMedia || !playStartTime) return;

    const durationWatched = Math.floor((new Date().getTime() - playStartTime.getTime()) / 1000);

    try {
      await mediaService.recordMediaPlay(currentMedia.id, {
        elderly_id: elderlyId,
        duration_watched: durationWatched,
        completed: completed ? 1 : 0,
        triggered_by: 'auto',
        mood_before: currentMood,
      });
    } catch (error) {
      console.error('记录播放失败:', error);
    }
  };

  // 处理反馈
  const handleFeedback = async (type: 'like' | 'dislike') => {
    if (!currentMedia || hasGivenFeedback) return;

    try {
      await mediaService.submitFeedback(currentMedia.id, {
        elderly_id: elderlyId,
        feedback_type: type,
      });
      setHasGivenFeedback(true);

      // 自动切换到下一个
      setTimeout(() => {
        handleNext();
      }, 1000);
    } catch (error) {
      console.error('提交反馈失败:', error);
    }
  };

  // 下一个媒体（循环播放）
  const handleNext = async () => {
    await recordPlay(true);

    // 计算下一个索引（循环播放）
    const nextIndex = (currentIndex + 1) % recommendedMedia.length;
    setCurrentIndex(nextIndex);
    // 记录下一个媒体的播放
    recordPlayStart(recommendedMedia[nextIndex].id);

    console.log(`[MediaPlayer] 切换到媒体 ${nextIndex + 1}/${recommendedMedia.length}`);
  };

  // 关闭播放器
  const handleClose = async () => {
    await recordPlay(false);
    onClose?.();
  };

  // 切换静音状态
  const toggleMute = () => {
    setIsMuted(prev => !prev);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      // 如果取消静音，确保视频继续播放
      if (isMuted && videoRef.current.paused) {
        videoRef.current.play().catch(err => {
          console.error('播放失败:', err);
        });
      }
    }
  };

  // 图片自动切换定时器（15秒后切换到下一个）
  useEffect(() => {
    if (!currentMedia || currentMedia.media_type !== 'photo' || isPaused) {
      return;
    }

    const timer = setTimeout(() => {
      console.log('[MediaPlayer] 图片展示15秒，自动切换到下一个');
      handleNext();
    }, 15 * 1000); // 15秒

    return () => clearTimeout(timer);
  }, [currentIndex, currentMedia, isPaused]);

  // 切换暂停状态
  const togglePause = () => {
    setIsPaused(prev => !prev);
    // 如果是视频，同步暂停/播放视频
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.play().catch(err => console.error('播放失败:', err));
      } else {
        videoRef.current.pause();
      }
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-white text-xl">正在加载...</div>
      </div>
    );
  }

  if (!currentMedia) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-white text-center">
          <p className="text-xl mb-4">暂时没有推荐的照片或视频</p>
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* 数字人小圆圈头像 - 左上角 */}
      <div className="absolute top-6 left-6 z-20">
        <div className="relative">
          {/* 数字人圆圈 */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-400 to-primary-500 shadow-2xl flex items-center justify-center border-4 border-white/30 backdrop-blur-sm animate-breathe">
            <div className="text-5xl">👤</div>
          </div>

          {/* 提示文字 */}
          <div className="absolute -bottom-10 left-0 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
            <p className="text-xs font-medium text-gray-700">随时问我</p>
          </div>
        </div>
      </div>

      {/* 标题和进度 - 顶部中间 */}
      <div className="absolute top-6 left-0 right-0 z-10 flex flex-col items-center gap-2 px-6">
        <p className="text-2xl font-bold text-white bg-black/60 backdrop-blur-sm px-6 py-3 rounded-2xl">
          {currentMedia.title}
        </p>
        {recommendedMedia.length > 1 && (
          <p className="text-base text-white bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full">
            {currentIndex + 1} / {recommendedMedia.length}
          </p>
        )}
      </div>

      {/* 媒体内容区 */}
      <div className="flex-1 flex items-center justify-center p-8">
        {currentMedia.media_type === 'photo' ? (
          <img
            src={mediaService.getMediaUrl(currentMedia.file_path)}
            alt={currentMedia.title}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            src={mediaService.getMediaUrl(currentMedia.file_path)}
            controls
            autoPlay={!isPaused}
            muted={isMuted}
            playsInline
            className="max-w-full max-h-full"
            onEnded={() => !isPaused && handleNext()}
          />
        )}
      </div>

      {/* 底部操作栏 - 悬浮 */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent backdrop-blur-md p-4">
        <div className="flex items-center justify-center gap-4 max-w-lg mx-auto">
          {/* 喜欢按钮 */}
          <button
            onClick={() => handleFeedback('like')}
            disabled={hasGivenFeedback}
            className={`${hasGivenFeedback ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'} text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all`}
            aria-label="喜欢"
          >
            <ThumbsUp size={28} strokeWidth={2.5} />
          </button>

          {/* 不喜欢按钮 */}
          <button
            onClick={() => handleFeedback('dislike')}
            disabled={hasGivenFeedback}
            className={`${hasGivenFeedback ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'} text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all`}
            aria-label="不喜欢"
          >
            <ThumbsDown size={28} strokeWidth={2.5} />
          </button>

          {/* 暂停/继续按钮 */}
          <button
            onClick={togglePause}
            className={`${isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-500 hover:bg-yellow-600'} text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all`}
            aria-label={isPaused ? '继续播放' : '暂停'}
          >
            {isPaused ? <Play size={28} strokeWidth={2.5} /> : <Pause size={28} strokeWidth={2.5} />}
          </button>

          {/* 声音切换按钮 - 仅视频时显示 */}
          {currentMedia.media_type === 'video' && (
            <button
              onClick={toggleMute}
              className={`${isMuted ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'} text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all`}
              aria-label={isMuted ? '开启声音' : '静音'}
            >
              {isMuted ? <VolumeX size={28} strokeWidth={2.5} /> : <Volume2 size={28} strokeWidth={2.5} />}
            </button>
          )}

          {/* 标签筛选按钮 */}
          {availableTags.length > 0 && (
            <button
              onClick={() => setShowTagFilter(true)}
              className={`${selectedTags.length > 0 ? 'bg-pink-500 hover:bg-pink-600' : 'bg-indigo-600 hover:bg-indigo-700'} text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all relative`}
              aria-label="标签筛选"
            >
              <Tag size={28} strokeWidth={2.5} />
              {selectedTags.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-pink-500 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {selectedTags.length}
                </span>
              )}
            </button>
          )}

          {/* 显示全部按钮 */}
          {recommendedMedia.length > 1 && (
            <button
              onClick={() => setShowGrid(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all"
              aria-label="查看全部"
            >
              <Grid3x3 size={28} strokeWidth={2.5} />
            </button>
          )}

          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            className="bg-gray-700 hover:bg-gray-800 text-white p-4 rounded-2xl shadow-xl active:scale-95 transition-all"
            aria-label="关闭"
          >
            <X size={28} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* 网格视图弹窗 */}
      {showGrid && (
        <MediaLibraryGrid
          mediaList={recommendedMedia.map(m => ({
            id: m.id.toString(),
            url: mediaService.getMediaUrl(m.file_path),
            thumbnailUrl: m.thumbnail_path ? mediaService.getThumbnailUrl(m.thumbnail_path) : undefined,
            type: m.media_type,
            caption: m.title,
            tags: m.tags || []
          }))}
          currentIndex={currentIndex}
          onSelect={(index) => {
            setCurrentIndex(index);
            setShowGrid(false);
          }}
          onClose={() => setShowGrid(false)}
        />
      )}

      {/* 标签筛选面板 */}
      {showTagFilter && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">选择标签筛选</h3>
              <button
                onClick={() => setShowTagFilter(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            {selectedTags.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">已选标签：</span>
                  <button
                    onClick={clearTagFilter}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    清除全部
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-medium flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => toggleTag(tag)}
                        className="hover:bg-pink-200 rounded-full p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <p className="text-sm text-gray-500 mb-3">点击添加标签（可多选）：</p>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-4 py-2 rounded-full text-base font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowTagFilter(false)}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
