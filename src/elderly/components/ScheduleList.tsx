import React from 'react';
import { X, Clock } from 'lucide-react';
import * as scheduleService from '../services/scheduleService';

interface ScheduleItem {
  time: string;
  title: string;
  type: 'medication' | 'meal' | 'activity' | 'other';
}

interface ScheduleListProps {
  schedules?: scheduleService.Schedule[];
  onClose: () => void;
}

/**
 * 日程列表组件
 * 显示今日所有待办事项
 */
export const ScheduleList: React.FC<ScheduleListProps> = ({ schedules: propSchedules, onClose }) => {
  // 使用传入的日程数据，或使用模拟数据
  const mockSchedules: ScheduleItem[] = [
    { time: '08:30', title: '喝水', type: 'other' },
    { time: '09:00', title: '早药时间 - 氯沙坦', type: 'medication' },
    { time: '12:00', title: '午餐', type: 'meal' },
    { time: '12:30', title: '午药时间', type: 'medication' },
    { time: '14:00', title: '午休', type: 'activity' },
    { time: '15:30', title: '下午茶', type: 'meal' },
    { time: '18:00', title: '晚餐', type: 'meal' },
    { time: '18:30', title: '晚药时间', type: 'medication' },
    { time: '21:00', title: '准备睡觉', type: 'activity' },
  ];

  // 将 API 数据转换为组件使用的格式
  const schedules: ScheduleItem[] = propSchedules
    ? scheduleService.sortSchedulesByTime(propSchedules).map((schedule) => ({
        time: scheduleService.formatTime(schedule.schedule_time),
        title: schedule.title + (schedule.description ? ` - ${schedule.description}` : ''),
        type: (schedule.schedule_type || 'other') as any,
      }))
    : mockSchedules;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'medication':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'meal':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'activity':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'medication':
        return '💊';
      case 'meal':
        return '🍽️';
      case 'activity':
        return '🏃';
      default:
        return '📌';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Clock size={32} className="text-primary-500" />
            <h2 className="text-elderly-xl font-bold text-gray-900">今日日程</h2>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="关闭"
          >
            <X size={28} />
          </button>
        </div>

        {/* 日程列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {schedules.map((item, index) => (
              <div
                key={index}
                className={`
                  flex items-center gap-4 p-4 rounded-2xl border-2
                  ${getTypeColor(item.type)}
                  transition-all hover:scale-[1.02]
                `}
              >
                <div className="text-4xl">{getTypeIcon(item.type)}</div>
                <div className="flex-1">
                  <div className="text-elderly-lg font-bold">{item.time}</div>
                  <div className="text-elderly-base mt-1">{item.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="btn-elderly bg-primary-500 hover:bg-primary-600 w-full"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
};
