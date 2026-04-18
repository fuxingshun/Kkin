import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Picker, Text, Textarea, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';
import { DEFAULT_FAMILY_ID } from '@/config/runtime';
import {
  createMessage,
  deleteMessage,
  getFamilyMessages,
  getFamilyUsers,
  type FamilyMessage,
  type FamilyUser,
} from '@/services/family';
import { combineDateTime, formatDateTimeText, formatDateValue, formatRelativeTime, formatTimeValue } from '@/utils/format';

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'scheduled', label: '待播报' },
  { key: 'played', label: '已播报' },
  { key: 'liked', label: '被喜欢' },
] as const;

type MessageTab = (typeof tabs)[number]['key'];

function createDefaultSchedule() {
  const next = new Date();
  next.setMinutes(next.getMinutes() + 10);
  return {
    dateValue: formatDateValue(next),
    timeValue: formatTimeValue(next),
  };
}

function getFamilySenders(users: FamilyUser[]) {
  const familyUsers = users.filter((item) => item.user_type === 'family');
  return familyUsers.length ? familyUsers : users;
}

function isFuture(value: string) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

function getMessageStatus(item: FamilyMessage) {
  if (item.played) {
    return { label: '已播报', tone: 'green' };
  }

  if (isFuture(item.scheduled_time)) {
    return { label: '待播报', tone: 'amber' };
  }

  return { label: '排队中', tone: 'blue' };
}

function filterMessages(messages: FamilyMessage[], tab: MessageTab) {
  switch (tab) {
    case 'scheduled':
      return messages.filter((item) => !item.played);
    case 'played':
      return messages.filter((item) => item.played);
    case 'liked':
      return messages.filter((item) => item.liked);
    default:
      return messages;
  }
}

export default function FamilyMessagesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [activeTab, setActiveTab] = useState<MessageTab>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [content, setContent] = useState('');
  const [senderIndex, setSenderIndex] = useState(0);
  const [dateValue, setDateValue] = useState(createDefaultSchedule().dateValue);
  const [timeValue, setTimeValue] = useState(createDefaultSchedule().timeValue);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nextMessages, nextUsers] = await Promise.all([getFamilyMessages(), getFamilyUsers()]);
      setMessages(nextMessages);
      setUsers(nextUsers);
    } catch (error) {
      const message = error instanceof Error ? error.message : '留言加载失败';
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

  const senders = useMemo(() => getFamilySenders(users), [users]);
  const currentSender = senders[senderIndex] || senders[0] || null;
  const visibleMessages = useMemo(() => filterMessages(messages, activeTab), [messages, activeTab]);

  async function handleCreate() {
    if (!content.trim()) {
      Taro.showToast({ title: '请先填写留言内容', icon: 'none' });
      return;
    }

    try {
      setSaving(true);
      await createMessage({
        family_id: currentSender?.family_id || DEFAULT_FAMILY_ID,
        content: content.trim(),
        sender_name: currentSender?.name || '家属',
        sender_relation: '家属',
        scheduled_time: combineDateTime(dateValue, timeValue),
      });
      Taro.showToast({ title: '留言已安排', icon: 'success' });
      setContent('');
      const nextSchedule = createDefaultSchedule();
      setDateValue(nextSchedule.dateValue);
      setTimeValue(nextSchedule.timeValue);
      setComposerOpen(false);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建留言失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSaving(false);
    }
  }

  async function handleResend(item: FamilyMessage) {
    try {
      const next = new Date();
      next.setMinutes(next.getMinutes() + 5);

      await createMessage({
        family_id: item.family_id || DEFAULT_FAMILY_ID,
        content: item.content,
        sender_name: item.sender_name,
        sender_relation: item.sender_relation || '家属',
        scheduled_time: combineDateTime(formatDateValue(next), formatTimeValue(next)),
      });
      Taro.showToast({ title: '已加入待播报队列', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '重发失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  async function handleDelete(item: FamilyMessage) {
    const result = await Taro.showModal({
      title: '删除留言',
      content: '确认删除这条留言安排吗？删除后老人端将不再播放它。',
    });

    if (!result.confirm) {
      return;
    }

    try {
      await deleteMessage(item.id);
      Taro.showToast({ title: '已删除', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-topbar ff-topbar--sticky'>
        <View>
          <Text className='ff-topbar__title'>留言管理</Text>
          <Text className='ff-topbar__desc'>安排家人的问候，按计划播报给老人</Text>
        </View>
        <Button className='ff-new-button' onClick={() => setComposerOpen((prev) => !prev)}>
          {composerOpen ? '收起' : '新建留言'}
        </Button>
      </View>

      <View className='ff-tab-strip'>
        {tabs.map((tab) => (
          <Text
            key={tab.key}
            className={`ff-tab ${tab.key === activeTab ? 'ff-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Text>
        ))}
      </View>

      <View className='ff-stack ff-stack--page'>
        {composerOpen ? (
          <View className='ff-card'>
            <View className='ff-section-head'>
              <View>
                <Text className='ff-section-title'>安排一条新留言</Text>
                <Text className='ff-card-subtitle'>当前只接真实可播报的文本留言，不再保留假“语音/视频”按钮</Text>
              </View>
            </View>
            <View className='ke-form'>
              <View>
                <Text className='ke-label'>留言人</Text>
                <Picker
                  mode='selector'
                  range={senders.map((item) => item.name)}
                  value={Math.min(senderIndex, Math.max(senders.length - 1, 0))}
                  onChange={(event) => setSenderIndex(Number(event.detail.value))}
                >
                  <View className='ke-input'>{currentSender?.name || '默认家属'}</View>
                </Picker>
              </View>
              <View>
                <Text className='ke-label'>播报日期</Text>
                <Picker mode='date' value={dateValue} onChange={(event) => setDateValue(event.detail.value)}>
                  <View className='ke-input'>{dateValue}</View>
                </Picker>
              </View>
              <View>
                <Text className='ke-label'>播报时间</Text>
                <Picker mode='time' value={timeValue} onChange={(event) => setTimeValue(event.detail.value)}>
                  <View className='ke-input'>{timeValue}</View>
                </Picker>
              </View>
              <View>
                <Text className='ke-label'>留言内容</Text>
                <Textarea
                  className='ke-textarea'
                  maxlength={200}
                  value={content}
                  placeholder='输入想让老人听到的话，比如提醒、问候或今天的小事。'
                  onInput={(event) => setContent(event.detail.value)}
                />
              </View>
              <View className='ke-form__row'>
                <Button className='ke-button--ghost' onClick={() => setComposerOpen(false)}>
                  取消
                </Button>
                <Button className='service-button service-button--primary' loading={saving} onClick={() => void handleCreate()}>
                  保存安排
                </Button>
              </View>
            </View>
          </View>
        ) : null}

        {visibleMessages.length ? (
          visibleMessages.map((item) => {
            const status = getMessageStatus(item);

            return (
              <View className='ff-message-card' key={item.id}>
                <View className={`ff-message-card__icon ff-message-card__icon--${status.tone}`}>
                  <Text>{item.sender_name.slice(0, 1)}</Text>
                </View>
                <View className='ff-message-card__body'>
                  <View className='ff-section-head ff-section-head--tight'>
                    <View>
                      <Text className='ff-card-title'>{item.sender_name}</Text>
                      <Text className='ff-card-meta'>安排于 {formatDateTimeText(item.scheduled_time)}</Text>
                    </View>
                    <Text className={`ff-chip ff-chip--${status.tone}`}>{status.label}</Text>
                  </View>
                  <Text className='ff-card-text'>{item.content}</Text>
                  <Text className='ff-card-meta'>
                    创建于 {formatRelativeTime(item.created_at)}{item.played_at ? ` · 播报于 ${formatDateTimeText(item.played_at)}` : ''}
                    {item.liked ? ' · 老人已点赞' : ''}
                  </Text>
                  <View className='ff-soft-button-row'>
                    <Text className='ff-soft-button' onClick={() => void handleResend(item)}>
                      立即重发
                    </Text>
                    <Text className='ff-soft-button ff-soft-button--plain' onClick={() => void handleDelete(item)}>
                      删除安排
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View className='ff-card'>
            <Text className='ff-section-title'>当前筛选下还没有留言</Text>
            <Text className='ff-card-subtitle'>
              {loading ? '正在同步留言列表...' : '可以先创建一条新的问候，老人端会按时间播报。'}
            </Text>
          </View>
        )}
      </View>

      <Button className='ff-fab' onClick={() => setComposerOpen((prev) => !prev)}>
        {composerOpen ? '×' : '+'}
      </Button>

      <BottomNav active='messages' />
    </View>
  );
}
