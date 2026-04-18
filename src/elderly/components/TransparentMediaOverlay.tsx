import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { API_ORIGIN } from '../../config/runtime';

interface TransparentMediaOverlayProps {
  mediaFilename: string;
  mediaType: 'photo' | 'video';
  avatarText?: string;
  duration?: number; // 展示时长(秒)，对于视频可设为0表示播放完成后自动关闭
  onClose: () => void;
  onVideoEnded?: () => void; // 视频播放完成回调
}

/**
 * 透明窗口媒体展示组件
 * 在数字人主页中部弹出，展示媒体文件
 */
export const TransparentMediaOverlay: React.FC<TransparentMediaOverlayProps> = ({
  mediaFilename,
  mediaType,
  avatarText,
  duration = 30, // 默认30秒
  onClose,
  onVideoEnded,
}) => {
  const [autoCloseTimer, setAutoCloseTimer] = useState<number>(duration);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [videoEnded, setVideoEnded] = useState<boolean>(false);

  // 构建媒体文件URL
  const mediaUrl = `${API_ORIGIN}/uploads/${mediaFilename}`;

  // 处理关闭（带淡出动画）
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // 等待淡出动画完成
  };

  // 自动关闭倒计时（仅对图片或设置了duration的视频生效）
  useEffect(() => {
    // 如果是视频且duration为0，则等待视频播放完成，不使用倒计时
    if (mediaType === 'video' && duration === 0) {
      return;
    }

    const interval = setInterval(() => {
      setAutoCloseTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [duration, mediaType]);

  // 处理视频播放完成
  const handleVideoEnded = () => {
    console.log('[TransparentMediaOverlay] 视频播放完成');
    setVideoEnded(true);
    onVideoEnded?.();
    // 视频播放完成后自动关闭
    handleClose();
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
      isClosing ? 'opacity-0' : 'opacity-100'
    }`}>
      {/* 媒体内容容器 - 下调10% */}
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4 pt-[calc(1rem+10vh)]">
        {/* 媒体内容 - 尽量大 */}
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          {mediaType === 'photo' ? (
            <img
              src={mediaUrl}
              alt="展示的照片"
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
              onError={(e) => {
                console.error('图片加载失败:', mediaUrl);
                (e.target as HTMLImageElement).src = '/placeholder-photo.jpg';
              }}
            />
          ) : (
            <video
              src={mediaUrl}
              controls
              autoPlay
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
              onEnded={handleVideoEnded}
              onError={() => {
                console.error('视频加载失败:', mediaUrl);
              }}
            />
          )}

          {/* 右上角: 倒计时 + 关闭按钮 */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {/* 倒计时（视频播放完成模式时显示播放中状态） */}
            {mediaType === 'video' && duration === 0 ? (
              <div className="bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-sm">
                {videoEnded ? '播放完成' : '播放中...'}
              </div>
            ) : (
              <div className="bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-sm">
                {autoCloseTimer}s
              </div>
            )}

            {/* 关闭按钮 */}
            <button
              onClick={handleClose}
              className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md hover:bg-black/60 text-white rounded-full transition-all hover:scale-110 active:scale-95"
              aria-label="关闭"
            >
              <X size={20} />
            </button>
          </div>

          {/* 底部: 标题文字（小半透明） */}
          {avatarText && (
            <div className="absolute bottom-3 left-3 right-3">
              <div className="bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-lg text-base text-center">
                {avatarText}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
