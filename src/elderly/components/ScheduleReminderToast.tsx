import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, Ban, X } from 'lucide-react';
import * as scheduleService from '../services/scheduleService';

interface ScheduleReminderToastProps {
  schedule: scheduleService.Schedule;
  onComplete: () => void;
  onSkip: () => void;
  onDismiss: () => void;
  onMissed: () => void; // 30分钟后自动标记为已错过
  onClose: () => void; // 手动关闭（不做任何操作）
}

/**
 * 日程提醒 Toast 组件
 * 以半透明悬浮卡片形式显示在屏幕下方
 * 30分钟后自动标记为已错过并关闭
 */
export const ScheduleReminderToast: React.FC<ScheduleReminderToastProps> = ({
  schedule,
  onComplete,
  onSkip,
  onDismiss,
  onMissed,
  onClose,
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState(30 * 60); // 30分钟
  const typeIcon = scheduleService.getScheduleTypeIcon(schedule.schedule_type || 'other');
  const typeLabel = scheduleService.getScheduleTypeLabel(schedule.schedule_type || 'other');
  const time = scheduleService.formatTime(schedule.schedule_time);

  // 倒计时：30分钟后自动标记为已错过
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          console.log('提醒已显示30分钟无操作，自动标记为已错过');
          onMissed();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onMissed]);

  // 格式化剩余时间 (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none animate-fadeIn">
      {/* 媒体内容容器 - 数字人中部，下调10% */}
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4 pt-[calc(1rem+10vh)] pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl max-w-3xl w-full pointer-events-auto border-2 border-primary-300">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="text-5xl">{typeIcon}</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={24} className="text-primary-600" />
                <span className="text-2xl font-bold text-primary-600">{time}</span>
              </div>
              <p className="text-lg text-gray-600">{typeLabel}</p>
            </div>
          </div>

          {/* 右上角：倒计时 + 关闭按钮 */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">
              {formatTime(remainingSeconds)}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
              aria-label="关闭"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="px-6 py-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {schedule.title}
          </h2>

          {schedule.description && (
            <p className="text-xl text-gray-700 leading-relaxed">
              {schedule.description}
            </p>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="px-6 pb-6 pt-2">
          <div className="flex gap-3">
            {/* 标记完成 */}
            <button
              onClick={onComplete}
              className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl flex items-center justify-center gap-2 text-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <CheckCircle size={28} />
              <span>完成</span>
            </button>

            {/* 推迟10分钟 */}
            <button
              onClick={onDismiss}
              className="flex-1 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl flex items-center justify-center gap-2 text-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <Clock size={28} />
              <span>推迟</span>
            </button>

            {/* 忽略 */}
            <button
              onClick={onSkip}
              className="flex-1 py-4 bg-gray-400 hover:bg-gray-500 text-white rounded-xl flex items-center justify-center gap-2 text-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <Ban size={28} />
              <span>忽略</span>
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
