import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Heart,
  Image as ImageIcon,
  Video,
  Maximize2,
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { TrendChart } from '../components/TrendChart';
import * as moodService from '../services/moodService';
import * as mediaService from '../services/mediaService';
import { FAY_HTTP_BASE_URL } from '../../config/runtime';

/**
 * 家属端 Dashboard - 今天概览
 * 手机浏览器优化 - 单列布局，紧凑显示
 * 一页看完今天所有重要信息
 */

interface DashboardProps {
  onNavigate?: (page: 'interaction' | 'messages' | 'care' | 'alerts' | 'media' | 'mood') => void;
}

interface ChatMessage {
  username: string;
  is_adopted: number;
  type: 'fay' | 'member';
  way: string;
  content: string;
  createtime: number;
  timetext: string;
}

const API_BASE_URL = FAY_HTTP_BASE_URL;
const familyId = 'family_001';

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [todayInteractionCount, setTodayInteractionCount] = useState(0);
  const [latestMood, setLatestMood] = useState<moodService.MoodRecord | null>(null);
  const [moodStats, setMoodStats] = useState<moodService.MoodStatsResponse | null>(null);
  const [recentPlays, setRecentPlays] = useState<mediaService.RecentPlay[]>([]);

  // 加载今日交互次数
  const loadTodayInteractionCount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/get-msg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: 'User', limit: 300 }),
      });

      if (response.ok) {
        const data = await response.json();
        const messages: ChatMessage[] = data.list || [];

        // 获取今天的开始时间戳（00:00:00）
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Math.floor(today.getTime() / 1000);

        // 统计今天老人说的话（type === 'member'）
        const todayMemberMessages = messages.filter(
          msg => msg.type === 'member' && msg.createtime >= todayTimestamp
        );

        setTodayInteractionCount(todayMemberMessages.length);
      }
    } catch (error) {
      console.error('获取今日交互次数失败:', error);
      // 失败时保持为0，不影响页面显示
    }
  };

  // 加载情绪数据
  const loadMoodData = async () => {
    try {
      const [latest, stats] = await Promise.all([
        moodService.getFamilyMoods(familyId, { limit: 1 }),
        moodService.getMoodStats(familyId, { days: 7 }),
      ]);

      if (latest.records.length > 0) {
        setLatestMood(latest.records[0]);
      }
      setMoodStats(stats);
    } catch (error) {
      console.error('加载情绪数据失败:', error);
    }
  };

  // 加载最近播放
  const loadRecentPlays = async () => {
    try {
      const plays = await mediaService.getRecentPlays(familyId, 2);
      setRecentPlays(plays);
    } catch (error) {
      console.error('加载最近播放失败:', error);
    }
  };

  useEffect(() => {
    loadTodayInteractionCount();
    loadMoodData();
    loadRecentPlays();
    // 每30秒刷新一次
    const interval = setInterval(() => {
      loadTodayInteractionCount();
      loadMoodData();
      loadRecentPlays();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // 情绪趋势数据 - 使用真实数据或默认数据
  const emotionData = moodStats?.daily_stats.map(stat => ({
    date: new Date(stat.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
    value: stat.avg_score,
  })) || [];


  // 格式化播放时间
  const formatPlayTime = (playedAt: string) => {
    const playTime = new Date(playedAt);
    const now = new Date();
    const diffMs = now.getTime() - playTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;

    return playTime.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* 主要内容区 - 手机优化 */}
      <div className="px-4 py-4">
        {/* 实时监控视频 */}
        <div className="card p-0 mb-4 overflow-hidden">
          <div className="relative">
            {/* 视频播放器 */}
            <div className="relative bg-gray-900 aspect-video">
              {/* 模拟视频画面 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Video size={48} className="text-gray-600" />
              </div>

              {/* 实时状态标签 */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-full text-xs font-medium">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                实时
              </div>

              {/* 全屏按钮 */}
              <button
                onClick={() => setIsVideoFullscreen(!isVideoFullscreen)}
                className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg transition-colors"
              >
                <Maximize2 size={18} />
              </button>

              {/* 视频信息叠加 */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <div className="text-white">
                  <div className="text-xs opacity-90 mb-0.5">客厅监控</div>
                  <div className="text-sm font-medium">张奶奶正在与数字人对话</div>
                </div>
              </div>
            </div>

            {/* 视频控制栏 */}
            <div className="bg-white border-t border-gray-200 px-4 py-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">画质：高清</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-600">延迟：&lt;1s</span>
                </div>
                <button className="text-primary-600 hover:text-primary-700 font-medium">
                  切换摄像头
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* 关键指标卡片 - 手机单列布局 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <MetricCard
            title="今日交互"
            value={`${todayInteractionCount}次`}
            subtitle="老人与数字人对话"
            icon={MessageCircle}
            color="blue"
            onClick={() => onNavigate?.('interaction')}
          />
          <MetricCard
            title="情绪状态"
            value={latestMood ? moodService.moodEmojiMap[latestMood.mood_type] : '暂无记录'}
            subtitle={latestMood
              ? `${latestMood.mood_score}分 · ${moodService.formatRecordTime(latestMood.recorded_at || latestMood.created_at || '')}`
              : '等待老人记录情绪'}
            icon={Heart}
            color={latestMood && latestMood.mood_score >= 6 ? 'green' : latestMood && latestMood.mood_score >= 4 ? 'yellow' : 'red'}
            onClick={() => onNavigate?.('mood')}
          />
        </div>

        {/* 趋势图表 - 手机单列堆叠 */}
        <div className="space-y-4 mb-4">
          <TrendChart
            title="近 7 天情绪趋势"
            data={emotionData}
            color="#10b981"
            height={220}
          />
        </div>

        {/* 最近播放 - 手机优化 */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-gray-900">最近播放</h3>
            <button
              onClick={() => onNavigate?.('media')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              全部
            </button>
          </div>
          {recentPlays.length > 0 ? (
            <div className="space-y-3">
              {recentPlays.map((media) => (
                <div
                  key={media.id}
                  className="flex gap-3 p-3 rounded-lg border border-gray-200 active:bg-primary-50 transition-colors"
                >
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {media.thumbnail_path ? (
                      <img
                        src={mediaService.getThumbnailUrl(media.thumbnail_path)}
                        alt={media.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon size={24} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 mb-1 truncate">
                      {media.title}
                    </h4>
                    <p className="text-xs text-gray-500 mb-2">{formatPlayTime(media.played_at)}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-600">👍 {media.likes}</span>
                      <span className="text-red-600">👎 {media.dislikes}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">还没有播放记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
