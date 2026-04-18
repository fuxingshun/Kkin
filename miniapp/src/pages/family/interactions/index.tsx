import { useCallback, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { DEFAULT_CHAT_USERNAME } from '@/config/runtime';
import {
  countTodayMemberMessages,
  formatInteractionTime,
  getInteractionHistory,
  groupMessagesByDate,
  sanitizeInteractionContent,
  type InteractionMessage,
} from '@/services/interaction';

function getSpeakerMeta(type: InteractionMessage['type']) {
  if (type === 'member') {
    return {
      title: '老人发言',
      caption: '主动表达或回应数字人',
      background: 'linear-gradient(135deg, rgba(217, 107, 59, 0.12), rgba(255, 251, 247, 0.95))',
    };
  }

  return {
    title: '数字人回复',
    caption: '由 Fay 服务返回的对话内容',
    background: 'linear-gradient(135deg, rgba(120, 147, 109, 0.10), rgba(255, 251, 247, 0.96))',
  };
}

export default function FamilyInteractionsPage() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [messages, setMessages] = useState<InteractionMessage[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const result = await getInteractionHistory(DEFAULT_CHAT_USERNAME, 100);
      setMessages(result.list);
      setErrorMessage(result.available ? '' : result.error || 'Fay 服务暂不可用');
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      setErrorMessage(message);
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  usePullDownRefresh(() => {
    void loadData();
  });

  const visibleMessages = messages.filter((item) => Boolean(sanitizeInteractionContent(item.content)));
  const groupedMessages = Object.entries(groupMessagesByDate(visibleMessages));
  const memberCount = visibleMessages.filter((item) => item.type === 'member').length;
  const fayCount = visibleMessages.filter((item) => item.type === 'fay').length;
  const todayCount = countTodayMemberMessages(visibleMessages);

  return (
    <View className='ke-page'>
      <View className='ke-hero'>
        <Text className='ke-eyebrow'>Interaction History</Text>
        <Text className='ke-title'>把老人和数字人的对话，整理成可回看的陪伴日志</Text>
        <Text className='ke-subtitle'>
          小程序版先保留最实用的记录查看能力，方便家属判断今天聊得多不多、聊了些什么，后续再补筛选和搜索。
        </Text>
        <View className='ke-chip-row' style={{ marginTop: '22rpx' }}>
          <Text className='ke-chip ke-chip--warm'>今日发言 {todayCount}</Text>
          <Text className='ke-chip'>总消息 {visibleMessages.length}</Text>
          <Text className='ke-chip'>{errorMessage ? '连接待检查' : 'Fay 已连通'}</Text>
        </View>
      </View>

      <View className='ke-section ke-grid-2'>
        <StatCard label='今日互动' value={String(todayCount)} hint='只统计老人主动发言' />
        <StatCard label='老人发言' value={String(memberCount)} hint='当前已拉取消息中的数量' />
        <StatCard label='数字人回复' value={String(fayCount)} hint='用于观察回应频率' />
        <StatCard label='最近拉取' value={String(visibleMessages.length)} hint='默认最近 100 条' />
      </View>

      {errorMessage ? (
        <SectionCard title='连接状态' caption='互动历史依赖 Fay 服务'>
          <EmptyState
            title='暂时还拿不到互动记录'
            hint='请确认 server/app.py 正在运行，并且服务端配置的 FAY_HTTP_BASE_URL 可以访问到 Fay。'
          />
        </SectionCard>
      ) : null}

      <SectionCard
        title='对话记录'
        caption='按日期分组展示'
        extra={
          <Text
            className='ke-section-caption'
            onClick={() => Taro.redirectTo({ url: '/pages/family/dashboard/index' })}
          >
            返回概览
          </Text>
        }
      >
        {groupedMessages.length ? (
          <View className='ke-stack'>
            {groupedMessages.map(([dateKey, items]) => (
              <View key={dateKey}>
                <View className='ke-chip-row' style={{ marginBottom: '16rpx' }}>
                  <Text className='ke-chip'>{dateKey}</Text>
                </View>
                <View className='ke-card-list'>
                  {items
                    .slice()
                    .reverse()
                    .map((item, index) => {
                      const content = sanitizeInteractionContent(item.content);
                      const speakerMeta = getSpeakerMeta(item.type);

                      return (
                        <View
                          className='ke-card'
                          key={`${item.createtime}-${item.type}-${index}`}
                          style={{ background: speakerMeta.background }}
                        >
                          <View className='ke-section-head' style={{ marginBottom: '10rpx' }}>
                            <Text className='ke-card__title'>{speakerMeta.title}</Text>
                            <Text className='ke-section-caption'>{formatInteractionTime(item.createtime)}</Text>
                          </View>
                          <View className='ke-card__meta'>
                            <Text>{speakerMeta.caption}</Text>
                            {item.way ? <Text>{item.way}</Text> : null}
                          </View>
                          <Text className='ke-card__body'>{content}</Text>
                        </View>
                      );
                    })}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title='还没有互动记录' hint='等老人开始和数字人对话后，这里会自动汇总成可回看的日志。' />
        )}
      </SectionCard>

      {loading ? <Text className='ke-footnote'>正在同步互动历史...</Text> : null}

      <BottomNav active='dashboard' />
    </View>
  );
}
