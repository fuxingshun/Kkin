import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';

interface MediaItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: 'photo' | 'video';
  caption: string;
  tags?: string[];
}

interface MediaLibraryGridProps {
  mediaList: MediaItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

/**
 * 媒体库网格视图
 * 类似手机相册的缩略图展示，支持标签筛选
 */
export const MediaLibraryGrid: React.FC<MediaLibraryGridProps> = ({
  mediaList,
  currentIndex,
  onSelect,
  onClose,
}) => {
  const [selectedTag, setSelectedTag] = useState<string>('全部');

  // 提取所有标签
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    mediaList.forEach(item => {
      item.tags?.forEach(tag => tagsSet.add(tag));
    });
    return ['全部', ...Array.from(tagsSet).sort()];
  }, [mediaList]);

  // 根据选中的标签筛选媒体
  const filteredMedia = useMemo(() => {
    if (selectedTag === '全部') {
      return mediaList;
    }
    return mediaList.filter(item => item.tags?.includes(selectedTag));
  }, [mediaList, selectedTag]);

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col">
      {/* 顶部区域 - 标题和标签 */}
      <div className="bg-gradient-to-b from-black/60 to-transparent">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-2xl font-bold text-white">回忆相册</h2>
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            aria-label="关闭"
          >
            <X size={28} className="text-white" strokeWidth={2.5} />
          </button>
        </div>

        {/* 标签筛选栏 */}
        {allTags.length > 1 && (
          <div className="px-4 pb-4">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`
                    px-5 py-2.5 rounded-full text-base font-medium whitespace-nowrap transition-all
                    ${selectedTag === tag
                      ? 'bg-primary-500 text-white shadow-lg scale-105'
                      : 'bg-white/20 text-white hover:bg-white/30'
                    }
                  `}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 网格视图 */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredMedia.length === 0 ? (
          <div className="text-center text-white py-12">
            <p className="text-xl">暂无"{selectedTag}"相关的照片或视频</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
            {filteredMedia.map((item) => {
              // 找到该项在原始列表中的索引
              const originalIndex = mediaList.findIndex(m => m.id === item.id);
              return (
            <button
              key={item.id}
              onClick={() => {
                onSelect(originalIndex);
              }}
              className={`
                relative aspect-square rounded-2xl overflow-hidden
                shadow-xl hover:scale-105 active:scale-95 transition-all
                ${originalIndex === currentIndex ? 'ring-4 ring-primary-500' : ''}
              `}
            >
              {/* 缩略图 */}
              {item.type === 'photo' ? (
                <img
                  src={item.url}
                  alt={item.caption}
                  className="w-full h-full object-cover"
                />
              ) : item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.caption}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <span className="text-4xl">🎬</span>
                </div>
              )}

              {/* 当前选中标识 */}
              {originalIndex === currentIndex && (
                <div className="absolute top-2 right-2 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg font-bold">✓</span>
                </div>
              )}

              {/* 标题遮罩 */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <p className="text-sm font-bold text-white line-clamp-2">
                  {item.caption}
                </p>
              </div>

              {/* 序号 */}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-full">
                {originalIndex + 1}
              </div>
            </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="p-4 bg-gradient-to-t from-black/60 to-transparent">
        <p className="text-center text-white text-base">
          {selectedTag === '全部'
            ? `共 ${mediaList.length} 张照片`
            : `${selectedTag}：${filteredMedia.length} 张照片`
          }
        </p>
      </div>
    </div>
  );
};
