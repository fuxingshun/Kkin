import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, RefreshCw } from 'lucide-react';
import { FAY_HTTP_BASE_URL } from '../../config/runtime';

/**
 * 聊天记录页面
 * 展示老人与数字人的聊天对话内容
 */

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

export const InteractionHistory: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const username = 'User'; // 实际使用时从用户上下文获取
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  // 加载聊天记录
  const loadChatHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/get-msg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, limit: 100 }),
      });

      if (!response.ok) {
        throw new Error('获取聊天记录失败');
      }

      const data = await response.json();
      // 按时间倒序排列，最新的在前面
      const sortedMessages = (data.list || []).sort(
        (a: ChatMessage, b: ChatMessage) => b.createtime - a.createtime
      );
      setMessages(sortedMessages);
    } catch (err) {
      console.error('加载聊天记录失败:', err);
      setError('无法连接到数字人服务');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChatHistory();
    // 每30秒刷新一次
    const interval = setInterval(loadChatHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  // 消息加载完成后滚动到底部
  useEffect(() => {
    if (!loading && messages.length > 0) {
      // 使用 setTimeout 确保 DOM 已更新
      setTimeout(scrollToBottom, 100);
    }
  }, [loading, messages]);

  // 过滤掉think标签内的内容
  const filterThinkContent = (content: string) => {
    return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  };

  // 格式化时间戳
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (isToday) {
      return timeStr;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `昨天 ${timeStr}`;
    }

    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    }) + ' ' + timeStr;
  };

  // 按日期分组消息
  const groupMessagesByDate = (msgs: ChatMessage[]) => {
    const groups: { [key: string]: ChatMessage[] } = {};

    msgs.forEach(msg => {
      const date = new Date(msg.createtime * 1000);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      let dateKey: string;
      if (isToday) {
        dateKey = '今天';
      } else if (isYesterday) {
        dateKey = '昨天';
      } else {
        dateKey = date.toLocaleDateString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
        });
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });

    return groups;
  };

  const groupedMessages = groupMessagesByDate(messages);

  // 显示加载状态
  if (loading && messages.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载聊天记录...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 overflow-y-auto px-4 py-4" ref={scrollContainerRef}>
        {/* 顶部标题和刷新按钮 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">聊天记录</h2>
          <button
            onClick={loadChatHistory}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-primary-600">{messages.length}</div>
            <div className="text-xs text-gray-600 mt-1">消息总数</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-green-600">
              {messages.filter(m => m.type === 'member').length}
            </div>
            <div className="text-xs text-gray-600 mt-1">老人发言</div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
            <p className="text-sm text-yellow-800">{error}</p>
          </div>
        )}

        {/* 聊天记录列表 */}
        {Object.keys(groupedMessages).length > 0 ? (
          Object.entries(groupedMessages).map(([dateKey, msgs]) => (
            <div key={dateKey} className="mb-6">
              {/* 日期分隔 */}
              <div className="flex items-center justify-center mb-4">
                <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                  {dateKey}
                </span>
              </div>

              {/* 消息列表 - 按时间正序显示 */}
              <div className="space-y-3">
                {[...msgs].reverse().map((msg, index) => (
                  <div
                    key={`${msg.createtime}-${index}`}
                    className={`flex gap-2 ${
                      msg.type === 'member' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {/* 头像 */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.type === 'fay'
                          ? 'bg-primary-100'
                          : 'bg-green-100'
                      }`}
                    >
                      {msg.type === 'fay' ? (
                        <Bot size={20} className="text-primary-600" />
                      ) : (
                        <User size={20} className="text-green-600" />
                      )}
                    </div>

                    {/* 消息气泡 */}
                    <div
                      className={`flex-1 ${
                        msg.type === 'member' ? 'flex flex-col items-end' : ''
                      }`}
                    >
                      <div
                        className={`inline-block max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          msg.type === 'fay'
                            ? 'bg-white border border-gray-200 shadow-sm'
                            : 'bg-primary-600 text-white shadow-sm'
                        }`}
                      >
                        <p
                          className={`text-sm leading-relaxed ${
                            msg.type === 'fay' ? 'text-gray-800' : 'text-white'
                          }`}
                        >
                          {filterThinkContent(msg.content)}
                        </p>
                      </div>
                      <div
                        className={`flex items-center gap-1 mt-1 px-2 ${
                          msg.type === 'member' ? 'justify-end' : ''
                        }`}
                      >
                        <span className="text-xs text-gray-400">
                          {formatTime(msg.createtime)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <Bot size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">暂无聊天记录</p>
          </div>
        )}
      </div>
    </div>
  );
};

