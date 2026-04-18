import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, XCircle, Info } from 'lucide-react';

interface MedicationCardProps {
  medicationName: string;
  dosage: string;
  timing: string; // 例如："早餐后" 或 "睡前"
  graceMinutes?: number; // 宽限期（分钟）
  onTaken?: () => void;
  onSnooze?: (minutes: number) => void;
  onSkip?: () => void;
  onInfo?: () => void;
}

/**
 * 用药提醒卡组件
 * 支持确认、稍后提醒、跳过等操作
 */
export const MedicationCard: React.FC<MedicationCardProps> = ({
  medicationName,
  dosage,
  timing,
  graceMinutes = 30,
  onTaken,
  onSnooze,
  onSkip,
  onInfo,
}) => {
  const [countdown, setCountdown] = useState(graceMinutes * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in p-6">
      <div className="card-elderly max-w-2xl w-full space-y-6">
        {/* 标题与信息按钮 */}
        <div className="flex items-center justify-between">
          <h2 className="text-elderly-xl font-bold text-gray-900">
            早药时间到了
          </h2>
          {onInfo && (
            <button
              onClick={onInfo}
              aria-label="药物信息"
              className="p-3 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Info size={32} className="text-primary-600" />
            </button>
          )}
        </div>

        {/* 药物信息 */}
        <div className="bg-primary-50 rounded-xl p-6 space-y-3">
          <p className="text-elderly-lg font-bold text-gray-900">
            {medicationName}
          </p>
          <p className="text-elderly-base text-gray-700">
            剂量：{dosage}
          </p>
          <p className="text-elderly-base text-gray-600">
            服用时间：{timing}
          </p>
        </div>

        {/* 倒计时 */}
        {countdown > 0 && (
          <div className="flex items-center justify-center gap-3 bg-yellow-50 rounded-xl p-4">
            <Clock size={28} className="text-yellow-600" />
            <p className="text-elderly-base text-gray-700">
              宽限时间剩余：<span className="font-bold text-yellow-700">{formatTime(countdown)}</span>
            </p>
          </div>
        )}

        {/* 操作按钮 - 纵向排列 */}
        <div className="space-y-4">
          <button
            onClick={onTaken}
            className="w-full btn-elderly bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-4"
          >
            <CheckCircle size={36} />
            <span>已服用</span>
          </button>

          <button
            onClick={() => onSnooze?.(10)}
            className="w-full btn-elderly bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-4"
          >
            <Clock size={36} />
            <span>稍后提醒（10分钟）</span>
          </button>

          <button
            onClick={onSkip}
            className="w-full btn-elderly bg-gray-400 hover:bg-gray-500 text-white flex items-center justify-center gap-4"
          >
            <XCircle size={36} />
            <span>今天先不吃</span>
          </button>
        </div>
      </div>
    </div>
  );
};
