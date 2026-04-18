import React, { useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Ban } from 'lucide-react';
import * as scheduleService from '../services/scheduleService';

interface ScheduleReminderProps {
  schedule: scheduleService.Schedule;
  onComplete: () => void;
  onSkip: () => void;
  onDismiss: () => void;
  onMissed: () => void; // 30分钟后自动标记为已错过
}

/**
 * 日程提醒弹窗组件
 * 当日程到达执行时间时弹出的大字体提醒
 * 30分钟后自动标记为已错过并关闭弹窗
 */
export const ScheduleReminder: React.FC<ScheduleReminderProps> = ({
  schedule,
  onComplete,
  onSkip,
  onDismiss,
  onMissed,
}) => {
  const typeIcon = scheduleService.getScheduleTypeIcon(schedule.schedule_type || 'other');
  const typeLabel = scheduleService.getScheduleTypeLabel(schedule.schedule_type || 'other');
  const time = scheduleService.formatTime(schedule.schedule_time);

  // 30分钟后自动标记为已错过
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('提醒弹窗已显示30分钟无操作，自动标记为已错过');
      onMissed();
    }, 30 * 60 * 1000); // 30分钟 = 1800000毫秒

    return () => clearTimeout(timer);
  }, [onMissed]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full animate-in zoom-in-95">
        {/* 头部 - 大图标 */}
        <div className="text-center pt-8 pb-6">
          <div className="text-8xl mb-4 animate-bounce">{typeIcon}</div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock size={32} className="text-primary-600" />
            <span className="text-elderly-2xl font-bold text-primary-600">
              {time}
            </span>
          </div>
          <p className="text-elderly-base text-gray-600">{typeLabel}</p>
        </div>

        {/* 主要内容 */}
        <div className="px-8 pb-8">
          <h1 className="text-elderly-3xl font-bold text-center text-gray-900 mb-4">
            {schedule.title}
          </h1>

          {schedule.description && (
            <p className="text-elderly-xl text-center text-gray-700 mb-6 leading-relaxed">
              {schedule.description}
            </p>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-col gap-4 mt-8">
            {/* 第一行：标记完成 */}
            <button
              onClick={onComplete}
              className="w-full btn-elderly bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-3"
            >
              <CheckCircle size={32} />
              <span>标记完成</span>
            </button>

            {/* 第二行：推迟执行 和 忽略行程 */}
            <div className="flex gap-4">
              <button
                onClick={onDismiss}
                className="flex-1 btn-elderly bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-3"
              >
                <XCircle size={32} />
                <span>推迟执行</span>
              </button>
              <button
                onClick={onSkip}
                className="flex-1 btn-elderly bg-gray-400 hover:bg-gray-500 text-white flex items-center justify-center gap-3"
              >
                <Ban size={32} />
                <span>忽略行程</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
