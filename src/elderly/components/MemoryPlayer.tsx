import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, X, Maximize2, ChevronLeft, ChevronRight, Grid3x3 } from 'lucide-react';
import { MediaLibraryGrid } from './MediaLibraryGrid';

interface MediaItem {
  id: string;
  url: string;
  type: 'photo' | 'video';
  caption: string;
}

interface MemoryPlayerProps {
  mediaUrl?: string;
  mediaType: 'photo' | 'video';
  title?: string;
  caption?: string;
  mode?: 'pip' | 'fullscreen';
  mediaList?: MediaItem[];
  currentIndex?: number;
  onLike?: () => void;
  onDislike?: () => void;
  onClose?: () => void;
  onToggleMode?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSelectMedia?: (index: number) => void;
}

/**
 * 媒体播放组件
 * 支持 PIP（画中画）和全屏模式
 */
export const MemoryPlayer: React.FC<MemoryPlayerProps> = ({
  mediaUrl = '/placeholder-photo.jpg',
  mediaType,
  caption = '小米 2018 秋游',
  mode = 'fullscreen',
  mediaList = [],
  currentIndex = 0,
  onLike,
  onDislike,
  onClose,
  onToggleMode,
  onNext,
  onPrevious,
  onSelectMedia,
}) => {
  const [liked, setLiked] = useState<boolean | null>(null);
  const [showGrid, setShowGrid] = useState(false);

  // 如果有素材库，使用当前索引的媒体
  const currentMedia = mediaList.length > 0 ? mediaList[currentIndex] : null;
  const displayUrl = currentMedia?.url || mediaUrl;
  const displayType = currentMedia?.type || mediaType;
  const displayCaption = currentMedia?.caption || caption;

  const hasPrevious = mediaList.length > 0 && currentIndex > 0;
  const hasNext = mediaList.length > 0 && currentIndex < mediaList.length - 1;

  const handleLike = () => {
    setLiked(true);
    onLike?.();
  };

  const handleDislike = () => {
    setLiked(false);
    onDislike?.();
  };

  const isPIP = mode === 'pip';

  if (isPIP) {
    // PIP 模式 - 小窗口在右上角
    return (
      <div className="fixed top-20 right-6 w-80 bg-white rounded-2xl shadow-2xl z-40 animate-fade-in overflow-hidden">
        {/* 媒体内容 */}
        <div className="relative bg-gray-200 aspect-video">
          {mediaType === 'photo' ? (
            <img
              src={mediaUrl}
              alt={caption}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={mediaUrl}
              controls
              autoPlay
              className="w-full h-full object-cover"
            />
          )}

          {/* 工具栏 */}
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              onClick={onToggleMode}
              className="p-2 bg-black bg-opacity-50 rounded-lg hover:bg-opacity-70 transition-colors"
              aria-label="切换全屏"
            >
              <Maximize2 size={20} className="text-white" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-black bg-opacity-50 rounded-lg hover:bg-opacity-70 transition-colors"
              aria-label="关闭"
            >
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* 标题 */}
        <div className="p-3">
          <p className="text-sm font-medium text-gray-900 truncate">{caption}</p>
        </div>
      </div>
    );
  }

  // 全屏模式 - 照片/视频占满屏幕，数字人小圆圈在右下角
  return (
    <div className="fixed inset-0 bg-black z-50 animate-fade-in">
      {/* 媒体内容区 - 占满整个屏幕 */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        {displayType === 'photo' ? (
          <img
            src={displayUrl}
            alt={displayCaption}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <video
            src={displayUrl}
            controls
            autoPlay
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* 左侧切换按钮 */}
      {hasPrevious && (
        <button
          onClick={onPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-16 h-16 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-full shadow-2xl active:scale-95 transition-all flex items-center justify-center"
          aria-label="上一张"
        >
          <ChevronLeft size={40} strokeWidth={2.5} />
        </button>
      )}

      {/* 右侧切换按钮 */}
      {hasNext && (
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-16 h-16 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-full shadow-2xl active:scale-95 transition-all flex items-center justify-center"
          aria-label="下一张"
        >
          <ChevronRight size={40} strokeWidth={2.5} />
        </button>
      )}

      {/* 标题和进度 - 顶部悬浮 */}
      {displayCaption && (
        <div className="absolute top-6 left-0 right-0 z-10 flex flex-col items-center gap-2 px-6">
          <p className="text-elderly-xl font-bold text-white bg-black/60 backdrop-blur-sm px-6 py-3 rounded-2xl">
            {displayCaption}
          </p>
          {mediaList.length > 0 && (
            <p className="text-base text-white bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full">
              {currentIndex + 1} / {mediaList.length}
            </p>
          )}
        </div>
      )}

      {/* 数字人小圆圈 - 右上角悬浮 */}
      <div className="absolute top-20 right-6 z-20">
        <div className="relative">
          {/* 数字人圆圈 */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-400 to-primary-500 shadow-2xl flex items-center justify-center border-4 border-white/30 backdrop-blur-sm animate-breathe">
            <div className="text-5xl">👤</div>
          </div>

          {/* 提示文字 */}
          <div className="absolute -bottom-10 right-0 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
            <p className="text-xs font-medium text-gray-700">随时问我</p>
          </div>
        </div>
      </div>

      {/* 底部操作栏 - 悬浮 */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent backdrop-blur-md p-4">
        <div className="flex items-center justify-center gap-4 max-w-lg mx-auto">
          {/* 喜欢按钮 */}
          <button
            onClick={handleLike}
            className={`
              ${liked === true ? 'bg-green-600' : 'bg-green-500 hover:bg-green-600'}
              text-white
              flex items-center justify-center gap-2
              px-6 py-4
              rounded-2xl
              shadow-xl
              active:scale-95
              transition-all
              flex-1
            `}
          >
            <ThumbsUp size={28} strokeWidth={2.5} />
            <span className="text-lg font-bold">喜欢</span>
          </button>

          {/* 不喜欢按钮 */}
          <button
            onClick={handleDislike}
            className={`
              ${liked === false ? 'bg-red-600' : 'bg-red-500 hover:bg-red-600'}
              text-white
              flex items-center justify-center gap-2
              px-6 py-4
              rounded-2xl
              shadow-xl
              active:scale-95
              transition-all
              flex-1
            `}
          >
            <ThumbsDown size={28} strokeWidth={2.5} />
            <span className="text-lg font-bold">不喜欢</span>
          </button>

          {/* 网格视图按钮 */}
          {mediaList.length > 0 && (
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
            onClick={onClose}
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
          mediaList={mediaList}
          currentIndex={currentIndex}
          onSelect={(index) => {
            onSelectMedia?.(index);
            setShowGrid(false);
          }}
          onClose={() => setShowGrid(false)}
        />
      )}
    </div>
  );
};
