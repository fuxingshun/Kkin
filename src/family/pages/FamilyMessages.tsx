import React, { useState, useEffect } from 'react';
import {
  Plus,
  X,
  Send,
  Heart,
  Trash2,
  User,
} from 'lucide-react';
import * as messageService from '../services/messageService';

type MessageType = 'text';

interface FamilyMessage {
  id: string;
  type: MessageType;
  content: string;
  sender: string;
  senderRelation: string; // 留言人称呼（如：儿子、女儿、孙女等）
  senderAvatar?: string;
  timestamp: string; // 留言创建时间
  scheduledTime?: string; // 预约播报时间（家属指定）
  played: boolean;
  playedAt?: string; // 实际播报时间（系统记录）
  liked: boolean;
}

/**
 * 家属留言页面
 * 家属可以给老人留文字留言
 * 老人端会播放这些留言
 */
export const FamilyMessages: React.FC = () => {
  const [showComposer, setShowComposer] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderRelation, setSenderRelation] = useState('');
  const [scheduledTime, setScheduledTime] = useState('now');
  const [customScheduledTime, setCustomScheduledTime] = useState('');
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const FAMILY_ID = 'family_001'; // 暂时硬编码，后续可从用户登录信息获取

  // 加载留言列表
  const loadMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await messageService.getFamilyMessages(FAMILY_ID);

      // 转换后端数据格式为前端格式
      const formattedMessages: FamilyMessage[] = data.map((msg) => ({
        id: String(msg.id),
        type: 'text' as MessageType,
        content: msg.content,
        sender: msg.sender_name,
        senderRelation: msg.sender_relation,
        timestamp: messageService.formatDateTime(msg.created_at),
        scheduledTime: messageService.formatDateTime(msg.scheduled_time),
        played: msg.played,
        playedAt: msg.played_at ? messageService.formatDateTime(msg.played_at) : undefined,
        liked: msg.liked,
      }));

      setMessages(formattedMessages);
    } catch (err) {
      console.error('加载留言失败:', err);
      setError('加载留言失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载留言
  useEffect(() => {
    loadMessages();
  }, []);

  const handleSendMessage = async () => {
    if (!messageContent.trim()) {
      alert('请输入留言内容');
      return;
    }
    if (!senderName.trim()) {
      alert('请输入您的姓名');
      return;
    }
    if (!senderRelation) {
      alert('请选择您与老人的关系');
      return;
    }
    if (scheduledTime === 'custom' && !customScheduledTime) {
      alert('请选择播报时间');
      return;
    }

    // 计算实际的播报时间（使用本地时间格式，与后端北京时间匹配）
    const getLocalTimeString = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    const actualScheduledTime = scheduledTime === 'now'
      ? getLocalTimeString()
      : customScheduledTime;

    try {
      setLoading(true);
      await messageService.createMessage({
        family_id: FAMILY_ID,
        content: messageContent,
        sender_name: senderName,
        sender_relation: senderRelation,
        scheduled_time: actualScheduledTime,
      });

      // 发送成功，重新加载列表
      await loadMessages();

      // 清空表单
      setMessageContent('');
      setSenderName('');
      setSenderRelation('');
      setScheduledTime('now');
      setCustomScheduledTime('');
      setShowComposer(false);
    } catch (err) {
      console.error('发送留言失败:', err);
      alert('发送留言失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm('确定要删除这条留言吗？')) {
      return;
    }

    try {
      setLoading(true);
      await messageService.deleteMessage(Number(msgId));

      // 删除成功，重新加载列表
      await loadMessages();

      alert('留言删除成功');
    } catch (err) {
      console.error('删除留言失败:', err);
      alert('删除留言失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">家属留言</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                给老人发送温馨留言
              </p>
            </div>
            <button
              onClick={() => setShowComposer(true)}
              className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Plus size={18} />
              留言
            </button>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 留言列表 */}
      <div className="px-4 py-4">
        {/* 加载状态 */}
        {loading && messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">加载中...</p>
          </div>
        )}

        {/* 统计卡片 */}
        {!loading && messages.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-primary-600">
              {messages.length}
            </div>
            <div className="text-xs text-gray-600 mt-1">总留言</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-green-600">
              {messages.filter((m) => m.played).length}
            </div>
            <div className="text-xs text-gray-600 mt-1">已播放</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-red-600">
              {messages.filter((m) => m.liked).length}
            </div>
            <div className="text-xs text-gray-600 mt-1">老人点赞</div>
          </div>
        </div>
        )}

        {/* 留言卡片列表 */}
        {!loading && messages.length > 0 && (
          <div className="space-y-3">
          {messages.map((msg) => (
              <div
                key={msg.id}
                className="card p-4 hover:shadow-md transition-shadow"
              >
                {/* 头部：发件人信息 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <User size={20} className="text-primary-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {msg.sender}
                        {msg.senderRelation && (
                          <span className="text-sm text-gray-500 ml-2">
                            ({msg.senderRelation})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* 留言内容 */}
                <div className="mb-3">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-gray-900 leading-relaxed">{msg.content}</p>
                  </div>
                </div>

                {/* 底部：状态标签和时间信息 */}
                <div className="flex flex-col gap-2">
                  {/* 预约播报时间 */}
                  {msg.scheduledTime && (
                    <div className="text-xs text-gray-600">
                      ⏰ 预约播报：{msg.scheduledTime}
                    </div>
                  )}

                  {/* 状态标签 */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        msg.played
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {msg.played ? '✓ 已播放' : '未播放'}
                    </span>
                    {msg.liked && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                        <Heart size={12} fill="currentColor" />
                        老人喜欢
                      </span>
                    )}
                  </div>

                  {/* 实际播报时间 */}
                  {msg.played && msg.playedAt && (
                    <div className="text-xs text-green-600">
                      🔊 实际播报：{msg.playedAt}
                    </div>
                  )}
                </div>
              </div>
          ))}
        </div>
        )}

        {/* 空状态 */}
        {!loading && messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">还没有留言</p>
            <button
              onClick={() => setShowComposer(true)}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              发送第一条留言
            </button>
          </div>
        )}
      </div>

      {/* 留言编辑器弹窗 */}
      {showComposer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="p-6 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">发送留言</h2>
              <button
                onClick={() => setShowComposer(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* 发送者姓名 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  您的姓名
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="请输入您的姓名"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  maxLength={20}
                />
              </div>

              {/* 称呼选择（卡片式） */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  您的称呼
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: '儿子', icon: '👨' },
                    { value: '女儿', icon: '👩' },
                    { value: '孙子', icon: '👦' },
                    { value: '孙女', icon: '👧' },
                    { value: '外孙', icon: '👦' },
                    { value: '外孙女', icon: '👧' },
                    { value: '女婿', icon: '🤵' },
                    { value: '儿媳', icon: '👰' },
                    { value: '侄子', icon: '👨‍🦱' },
                    { value: '侄女', icon: '👩‍🦱' },
                    { value: '其他', icon: '👤' },
                  ].map((relation) => (
                    <button
                      key={relation.value}
                      type="button"
                      onClick={() => setSenderRelation(relation.value)}
                      className={`px-3 py-3 rounded-lg border-2 transition-all text-sm font-medium flex flex-col items-center justify-center gap-1 ${
                        senderRelation === relation.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-2xl">{relation.icon}</span>
                      <span>{relation.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 播报时间 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  播报时间
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setScheduledTime('now')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                      scheduledTime === 'now'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    🚀 立即发送
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduledTime('custom')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                      scheduledTime === 'custom'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    ⏰ 预约时间
                  </button>
                </div>
                {scheduledTime === 'custom' && (
                  <input
                    type="datetime-local"
                    value={customScheduledTime}
                    onChange={(e) => setCustomScheduledTime(e.target.value)}
                    min={(() => {
                      const now = new Date();
                      const year = now.getFullYear();
                      const month = String(now.getMonth() + 1).padStart(2, '0');
                      const day = String(now.getDate()).padStart(2, '0');
                      const hours = String(now.getHours()).padStart(2, '0');
                      const minutes = String(now.getMinutes()).padStart(2, '0');
                      return `${year}-${month}-${day}T${hours}:${minutes}`;
                    })()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {scheduledTime === 'now' ? '💬 留言将立即播报给老人' : '⏰ 留言将在指定时间播报给老人'}
                </p>
              </div>

              {/* 文字输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  留言内容
                </label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="输入您想对老人说的话..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-2">
                  {messageContent.length} / 500 字
                </p>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="p-4 border-t flex gap-3 flex-shrink-0">
              <button
                onClick={() => setShowComposer(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!messageContent.trim() || !senderName.trim() || !senderRelation || (scheduledTime === 'custom' && !customScheduledTime) || loading}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send size={18} />
                {loading ? '发送中...' : '发送'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
