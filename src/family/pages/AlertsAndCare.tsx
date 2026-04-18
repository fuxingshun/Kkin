import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  Send,
  CheckCircle,
  Phone,
} from 'lucide-react';
import * as messageService from '../services/messageService';

interface Alert {
  id: string;
  level: 'low' | 'medium' | 'high';
  type: 'medication' | 'emotion' | 'inactive' | 'emergency' | 'sos_emergency' | 'contact_family';
  message: string;
  timestamp: string;
  handled: boolean;
}

/**
 * 家属端通知与远程关怀界面
 * 显示通知时间线，支持发送祝福消息
 */
export const AlertsAndCare: React.FC = () => {
  const [showMessageComposer, setShowMessageComposer] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [deliveryTiming, setDeliveryTiming] = useState('asap');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'unhandled' | 'high'>('all');
  const [stats, setStats] = useState<{
    total: number;
    unhandled: number;
    high: number;
  }>({ total: 0, unhandled: 0, high: 0 });
  const familyId = 'family_001'; // 实际使用时从用户上下文获取

  // 加载消息/告警数据
  useEffect(() => {
    loadAlerts();
    loadStats();
    // 每10秒轮询一次新消息
    const interval = setInterval(() => {
      loadAlerts();
      loadStats();
    }, 10000);
    return () => clearInterval(interval);
  }, [filterType]);

  const loadStats = async () => {
    try {
      const statsData = await messageService.getAlertStats(familyId);

      // 计算各个筛选项的数量
      // total 应该是所有消息的总数，而不是今天的消息数
      const totalFromLevels = Object.values(statsData.level_stats || {}).reduce((sum, count) => sum + count, 0);
      const total = totalFromLevels;
      const unhandled = statsData.status_stats?.unhandled || 0;
      const high = statsData.level_stats?.high || 0;

      setStats({ total, unhandled, high });
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      setLoading(true);

      // 根据筛选类型设置API参数
      const options: any = {};
      if (filterType === 'unhandled') {
        options.handled = false;
      } else if (filterType === 'high') {
        options.level = 'high';
      }

      const { alerts: data } = await messageService.getFamilyAlerts(familyId, options);

      // 转换数据格式
      const convertedAlerts: Alert[] = data.map((alert) => ({
        id: alert.id.toString(),
        level: alert.level,
        type: alert.alert_type,
        message: alert.message,
        timestamp: new Date(alert.created_at).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        handled: alert.handled,
      }));

      setAlerts(convertedAlerts);
    } catch (error) {
      console.error('加载消息失败:', error);
      // 如果API失败，使用模拟数据
      setAlerts([
        {
          id: '1',
          level: 'high',
          type: 'emotion',
          message: '检测到连续负面情绪，已触发安抚流程',
          timestamp: '2023-11-13 14:30',
          handled: false,
        },
        {
          id: '2',
          level: 'medium',
          type: 'medication',
          message: '晚药延迟 15 分钟服用',
          timestamp: '2023-11-13 20:15',
          handled: true,
        },
        {
          id: '3',
          level: 'low',
          type: 'inactive',
          message: '下午时段互动较少（仅 1 次对话）',
          timestamp: '2023-11-13 17:00',
          handled: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getLevelConfig = (level: Alert['level']) => {
    switch (level) {
      case 'high':
        return {
          bg: 'bg-red-50',
          border: 'border-red-400',
          text: 'text-red-700',
          icon: AlertTriangle,
          label: '🚨 紧急',
        };
      case 'medium':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-400',
          text: 'text-orange-700',
          icon: Phone,
          label: '📞 普通',
        };
      case 'low':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-400',
          text: 'text-yellow-700',
          icon: Clock,
          label: '💡 提示',
        };
    }
  };

  const handleMarkAsHandled = async (alertId: string) => {
    try {
      await messageService.handleAlert(Number(alertId));
      // 重新加载数据和统计
      await loadAlerts();
      await loadStats();
    } catch (error) {
      console.error('标记为已处理失败:', error);
    }
  };

  const handleSendMessage = () => {
    console.log('Send message:', { messageText, deliveryTiming });
    setShowMessageComposer(false);
    setMessageText('');
  };

  // 显示加载状态
  if (loading && alerts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载消息...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">通知</h1>
          </div>

          {/* 筛选器 */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filterType === 'all'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全部 ({stats.total})
            </button>
            <button
              onClick={() => setFilterType('unhandled')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filterType === 'unhandled'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              未处理 ({stats.unhandled})
            </button>
            <button
              onClick={() => setFilterType('high')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filterType === 'high'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              重要 ({stats.high})
            </button>
          </div>
        </div>
      </div>

      {/* 主要内容区 - 手机优化 */}
      <div className="px-4 py-4">
        {/* 通知列表 */}
        <div className="space-y-3">
          {alerts.map((alert) => {
            const config = getLevelConfig(alert.level);
            const Icon = config.icon;

            return (
              <div
                key={alert.id}
                className={`p-4 border-l-4 rounded-lg ${config.bg} ${config.border}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={config.text} size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-bold ${config.text} uppercase`}>
                        {config.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {alert.timestamp}
                      </span>
                      {alert.handled && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle size={14} />
                          已处理
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${config.text} font-medium mb-3`}>
                      {alert.message}
                    </p>
                    {!alert.handled && (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleMarkAsHandled(alert.id)}
                          className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                          标记已处理
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 空状态 */}
        {alerts.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500">暂无通知</p>
          </div>
        )}
      </div>

      {/* 消息编辑器弹窗 */}
      {showMessageComposer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">发送祝福消息</h2>

            {/* 消息类型选择 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                消息类型
              </label>
              <div className="flex gap-3">
                <button className="flex-1 p-3 border-2 border-primary-600 bg-primary-50 text-primary-700 rounded-lg font-medium">
                  文字消息
                </button>
                <button className="flex-1 p-3 border-2 border-gray-200 text-gray-700 rounded-lg font-medium hover:border-gray-300">
                  语音消息
                </button>
              </div>
            </div>

            {/* 消息内容 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                消息内容
              </label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="请输入您想对老人说的话..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>

            {/* 投递时机 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                投递时机
              </label>
              <select
                value={deliveryTiming}
                onChange={(e) => setDeliveryTiming(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="asap">尽快播报</option>
                <option value="tonight">今晚 19:00 前</option>
                <option value="emotion">情绪低落时</option>
                <option value="after_meal">用餐后</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                数字人会在合适的时机转述您的消息
              </p>
            </div>

            {/* 快捷短语 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                快捷短语
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  '记得按时吃药',
                  '多喝水',
                  '天气转凉，注意保暖',
                  '想你了',
                  '我爱你',
                ].map((phrase, index) => (
                  <button
                    key={index}
                    onClick={() => setMessageText(phrase)}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowMessageComposer(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim()}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send size={18} />
                发送
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
