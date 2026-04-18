import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Taro, { useDidHide, useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Text, Textarea, View } from '@tarojs/components';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { DEFAULT_CHAT_USERNAME } from '@/config/runtime';
import {
  chatWithAvatar,
  getAvatarRelayStatus,
  speakWithAvatar,
  toggleAvatarMicrophone,
  type AvatarRelayStatus,
} from '@/services/avatar';
import {
  formatInteractionTime,
  getInteractionHistory,
  sanitizeInteractionContent,
  type InteractionMessage,
} from '@/services/interaction';
import { getElderlySession } from '@/utils/session';

type BusyAction = 'chat' | 'microphone' | 'speak' | null;
type ChatRole = 'assistant' | 'user';

interface ChatItem {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  timeLabel: string;
  source: 'local' | 'history';
}

const DEFAULT_GREETING = '张奶奶，您好呀，我在这里陪着您。今天我们慢慢聊，不着急。';
const DEFAULT_REMINDER = '到提醒时间了，先喝几口温水，我们再一起看看今天的安排。';

function createChatItem(
  role: ChatRole,
  content: string,
  createdAt = Date.now(),
  source: ChatItem['source'] = 'local'
): ChatItem {
  return {
    id: `${role}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt,
    timeLabel: formatInteractionTime(Math.floor(createdAt / 1000)),
    source,
  };
}

function normalizeInteractionHistory(messages: InteractionMessage[]) {
  return messages
    .map((item) => {
      const content = sanitizeInteractionContent(item.content || '');
      if (!content) {
        return null;
      }

      const createdAt = item.createtime > 1e12 ? item.createtime : item.createtime * 1000;
      return createChatItem(item.type === 'fay' ? 'assistant' : 'user', content, createdAt, 'history');
    })
    .filter((item): item is ChatItem => Boolean(item))
    .sort((left, right) => right.createdAt - left.createdAt);
}

function mergeConversation(current: ChatItem[], incoming: ChatItem[]) {
  const merged = new Map<string, ChatItem>();

  [...incoming, ...current].forEach((item) => {
    const key = `${item.role}|${Math.floor(item.createdAt / 1000)}|${item.content}`;
    const existing = merged.get(key);

    if (!existing || item.source === 'history') {
      merged.set(key, item);
    }
  });

  return Array.from(merged.values())
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 24);
}

function formatMillisLabel(value: number | null) {
  if (value === null || value < 0) {
    return '未同步';
  }

  if (value < 1000) {
    return `${value}ms`;
  }

  return `${(value / 1000).toFixed(1)}s`;
}

interface AvatarRelayScreenProps {
  stageOnly?: boolean;
}

export function AvatarRelayScreen({ stageOnly = false }: AvatarRelayScreenProps) {
  const { elderName } = getElderlySession();
  const [loading, setLoading] = useState(true);
  const [rendererStatus, setRendererStatus] = useState<AvatarRelayStatus | null>(null);
  const [conversation, setConversation] = useState<ChatItem[]>([]);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [notice, setNotice] = useState('数字人已就绪，可以试播或发送一句话。');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textareaResetKey, setTextareaResetKey] = useState(0);
  const audioContextRef = useRef<any>(null);
  const pollTimerRef = useRef<number | null>(null);
  const conversationPollTimerRef = useRef<number | null>(null);
  const lastReplyRef = useRef('');
  const customTextDraftRef = useRef('');
  const audioQueueRef = useRef<string[]>([]);
  const audioPlayingRef = useRef(false);

  const lastReply = useMemo(
    () => conversation.find((item) => item.role === 'assistant')?.content || lastReplyRef.current,
    [conversation]
  );
  const playNextAudio = useCallback(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext || audioPlayingRef.current) {
      return;
    }

    const nextUrl = audioQueueRef.current.shift();
    if (!nextUrl) {
      return;
    }

    try {
      audioPlayingRef.current = true;
      audioContext.src = nextUrl;
      audioContext.play();
      setIsSpeaking(true);
    } catch (error) {
      audioPlayingRef.current = false;
      setIsSpeaking(false);
      console.warn('[miniapp-avatar] audio play failed', error);
      playNextAudio();
    }
  }, []);

  useEffect(() => {
    const audioContext = Taro.createInnerAudioContext();
    audioContext.autoplay = false;
    audioContext.obeyMuteSwitch = false;
    audioContext.onPlay(() => {
      setIsSpeaking(true);
    });
    audioContext.onPause(() => {
      audioPlayingRef.current = false;
      setIsSpeaking(false);
    });
    audioContext.onStop(() => {
      audioPlayingRef.current = false;
      setIsSpeaking(false);
    });
    audioContext.onEnded(() => {
      audioPlayingRef.current = false;
      setIsSpeaking(false);
      playNextAudio();
    });
    audioContext.onError((error) => {
      audioPlayingRef.current = false;
      setIsSpeaking(false);
      console.warn('[miniapp-avatar] audio queue item failed', error);
      playNextAudio();
    });
    audioContextRef.current = audioContext;

    return () => {
      audioQueueRef.current = [];
      audioPlayingRef.current = false;
      audioContext.destroy();
      audioContextRef.current = null;
    };
  }, [playNextAudio]);

  const playAudio = useCallback(async (url: string) => {
    if (!url) {
      return;
    }

    audioQueueRef.current.push(url);
    playNextAudio();
  }, [playNextAudio]);

  const syncConversation = useCallback(async (silent = false) => {
    try {
      const history = await getInteractionHistory(DEFAULT_CHAT_USERNAME, 24);
      const historyItems = normalizeInteractionHistory(history.list || []);
      let mergedConversation = historyItems;

      setConversation((current) => {
        const recentLocalItems = current.filter(
          (item) => item.source === 'local' && Date.now() - item.createdAt < 90 * 1000
        );
        mergedConversation = mergeConversation(recentLocalItems, historyItems);
        return mergedConversation;
      });

      const latestAssistant = mergedConversation.find((item) => item.role === 'assistant');
      if (latestAssistant) {
        lastReplyRef.current = latestAssistant.content;
      }

      return mergedConversation;
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : '最近对话同步失败';
        setNotice(message);
      }

      return [] as ChatItem[];
    }
  }, []);

  const syncRendererStatus = useCallback(async (silent = false) => {
    try {
      const status = await getAvatarRelayStatus();
      setRendererStatus(status);
      setMicrophoneEnabled(status.lastCommandType === 'microphone' ? status.lastCommandText !== 'disabled' : microphoneEnabled);

      if (status.lastError && status.rendererOnline) {
        setNotice(status.lastError);
      } else if (status.lastNotice) {
        setNotice(status.lastNotice);
      } else {
        setNotice('数字人已就绪，可以试播或发送一句话。');
      }

      return status;
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : '数字人状态同步失败';
        setNotice(message);
      }

      return null;
    }
  }, [microphoneEnabled, playAudio]);

  const syncAll = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      await Promise.all([syncRendererStatus(silent), stageOnly ? Promise.resolve([]) : syncConversation(silent)]);
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, [stageOnly, syncConversation, syncRendererStatus]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      return;
    }

    pollTimerRef.current = setInterval(() => {
      void syncRendererStatus(true);
    }, 3000);

    if (!stageOnly && conversationPollTimerRef.current === null) {
      conversationPollTimerRef.current = setInterval(() => {
        void syncConversation(true);
      }, 5000);
    }
  }, [stageOnly, syncConversation, syncRendererStatus]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (conversationPollTimerRef.current !== null) {
      clearInterval(conversationPollTimerRef.current);
      conversationPollTimerRef.current = null;
    }
  }, []);

  useDidShow(() => {
    void syncAll();
    startPolling();
  });

  useDidHide(() => {
    stopPolling();
  });

  usePullDownRefresh(() => {
    void syncAll();
  });

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  async function handleSpeak(text: string) {
    if (busyAction !== null) {
      return;
    }

    const content = text.trim();
    if (!content) {
      return;
    }

    try {
      setBusyAction('speak');
      setNotice('正在驱动数字人播报...');

      const result = await speakWithAvatar(content, DEFAULT_CHAT_USERNAME);
      if (result.audioUrl) {
        await playAudio(result.audioUrl);
      }

      if (result.audioError) {
        setNotice(`已发送播报命令，但音频生成失败：${result.audioError}`);
      } else {
        setNotice('数字人已收到播报指令。');
      }

      await syncRendererStatus(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '数字人播报失败';
      setNotice(message);
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleChat() {
    if (busyAction !== null) {
      return;
    }

    const message = customTextDraftRef.current.trim();
    if (!message) {
      setNotice('请先输入一句想对数字人说的话。');
      return;
    }

    const startedAt = Date.now();
    const userItem = createChatItem('user', message, startedAt, 'local');

    try {
      setBusyAction('chat');
      setConversation((current) => mergeConversation(current, [userItem]));
      customTextDraftRef.current = '';
      setTextareaResetKey((current) => current + 1);
      setNotice('正在通过 Fay 生成回复...');

      const result = await chatWithAvatar(message, DEFAULT_CHAT_USERNAME);
      const reply = sanitizeInteractionContent(result.reply || '');

      if (reply) {
        const assistantItem = createChatItem('assistant', reply, Date.now(), 'local');
        lastReplyRef.current = reply;
        setConversation((current) => mergeConversation(current, [assistantItem]));
        setNotice(reply);
      } else if (result.noReply) {
        setNotice('Fay 已接收消息，但这次没有返回可播报文本。');
      }

      if (result.audioUrl) {
        await playAudio(result.audioUrl);
      }

      await Promise.all([syncRendererStatus(true), syncConversation(true)]);
    } catch (error) {
      const notify = error instanceof Error ? error.message : 'Fay 对话失败';
      setNotice(notify);
      Taro.showToast({ title: notify, icon: 'none' });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleMicrophone(nextEnabled: boolean) {
    try {
      setBusyAction('microphone');
      const enabled = await toggleAvatarMicrophone(nextEnabled);
      setMicrophoneEnabled(enabled);
      setNotice(enabled ? '麦克风已开启。' : '麦克风已关闭。');
      await syncRendererStatus(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '麦克风切换失败';
      setNotice(message);
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <View className='ke-page ke-page--compact'>
      <View className='ke-hero'>
        <Text className='ke-eyebrow'>{stageOnly ? 'Fallback Stage' : 'Fallback Preview'}</Text>
        <Text className='ke-title'>{elderName} 的数字人陪伴页</Text>
        <Text className='ke-subtitle'>
          当前显示的是小程序原生兜底预览，不是魔珐星云平台中配置的 3D 数字人。真实星云数字人需要走官方 H5、Android SDK 或视频生成/流式输出能力。
        </Text>
        <View className='ke-chip-row' style={{ marginTop: '22rpx' }}>
          <Text className='ke-chip'>原生兜底预览</Text>
          <Text className='ke-chip ke-chip--warm'>语音 {isSpeaking ? '播报中' : '待命'}</Text>
          <Text className='ke-chip'>{microphoneEnabled ? '麦克风已开启' : '麦克风已关闭'}</Text>
        </View>
      </View>

      <SectionCard
        title={stageOnly ? '数字人舞台' : '实时数字人'}
        caption='这里不是星云 3D 角色，只用于保证小程序端交互链路可见。'
      >
        <View className='ke-avatar-relay'>
          <View className={`ke-avatar-stage ke-xmov-native-avatar ${isSpeaking ? 'ke-avatar-stage--speaking' : ''}`}>
            <View className='ke-avatar-ring ke-avatar-ring--one' />
            <View className='ke-avatar-ring ke-avatar-ring--two' />
            <View className='ke-xmov-otter'>
              <View className='ke-xmov-otter__ear ke-xmov-otter__ear--left' />
              <View className='ke-xmov-otter__ear ke-xmov-otter__ear--right' />
              <View className='ke-xmov-otter__head'>
                <View className='ke-xmov-otter__flower-row'>
                  <View className='ke-xmov-otter__flower' />
                  <View className='ke-xmov-otter__flower ke-xmov-otter__flower--light' />
                  <View className='ke-xmov-otter__flower' />
                  <View className='ke-xmov-otter__flower ke-xmov-otter__flower--light' />
                </View>
                <View className='ke-xmov-otter__eyes'>
                  <View className='ke-xmov-otter__eye' />
                  <View className='ke-xmov-otter__eye' />
                </View>
                <View className='ke-xmov-otter__nose' />
                <View className={`ke-xmov-otter__mouth ${isSpeaking ? 'ke-xmov-otter__mouth--speaking' : ''}`} />
              </View>
              <View className='ke-xmov-otter__body'>
                <View className='ke-xmov-otter__lei'>
                  <View className='ke-xmov-otter__lei-dot' />
                  <View className='ke-xmov-otter__lei-dot ke-xmov-otter__lei-dot--light' />
                  <View className='ke-xmov-otter__lei-dot' />
                  <View className='ke-xmov-otter__lei-dot ke-xmov-otter__lei-dot--light' />
                  <View className='ke-xmov-otter__lei-dot' />
                </View>
              </View>
            </View>
            <View className='ke-avatar-bubble'>
              <Text className='ke-card__body'>{isSpeaking ? '正在播报中...' : `${notice}（当前为兜底预览形象）`}</Text>
            </View>
          </View>

          <View className='ke-avatar-status-grid' style={{ marginTop: '18rpx' }}>
            <View className='ke-card'>
              <Text className='ke-section-caption'>展示方式</Text>
              <Text className='ke-card__title'>小程序原生</Text>
            </View>
            <View className='ke-card'>
              <Text className='ke-section-caption'>对话链路</Text>
              <Text className='ke-card__title'>Fay / 后端</Text>
            </View>
            <View className='ke-card'>
              <Text className='ke-section-caption'>最近同步</Text>
              <Text className='ke-card__title'>{formatMillisLabel(rendererStatus?.rendererAgeMs ?? null)}</Text>
            </View>
            <View className='ke-card'>
              <Text className='ke-section-caption'>音频状态</Text>
              <Text className='ke-card__title'>{isSpeaking ? 'playing' : 'ready'}</Text>
            </View>
          </View>

          <View className='ke-avatar-bubble'>
            <Text className='ke-card__body'>{notice}</Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard title='快速播报' caption='这些按钮会驱动渲染器里的星云数字人播报，并在小程序端同步播放音频。'>
        <View className='ke-avatar-quick-grid'>
          <Button
            className='ke-button'
            loading={busyAction === 'speak'}
            onClick={() => void handleSpeak(DEFAULT_GREETING)}
          >
            试播欢迎词
          </Button>
          <Button
            className='ke-button--ghost'
            loading={busyAction === 'speak'}
            onClick={() => void handleSpeak(DEFAULT_REMINDER)}
          >
            试播提醒词
          </Button>
          <Button
            className='ke-button--ghost'
            loading={busyAction === 'microphone'}
            onClick={() => void handleToggleMicrophone(!microphoneEnabled)}
          >
            {microphoneEnabled ? '关闭麦克风' : '开启麦克风'}
          </Button>
          {!stageOnly ? (
            <Button
              className='ke-button--ghost'
              onClick={() => {
                void syncAll(true);
                Taro.showToast({ title: '已同步最新状态', icon: 'success' });
              }}
            >
              立即同步
            </Button>
          ) : (
            <Button
              className='ke-button--ghost'
              onClick={() => {
                void syncRendererStatus(true);
                Taro.showToast({ title: '舞台状态已刷新', icon: 'success' });
              }}
            >
              刷新舞台
            </Button>
          )}
        </View>
      </SectionCard>

      {!stageOnly ? (
        <>
          <SectionCard title='通过 Fay 对话' caption='发一句话给数字人，Fay 负责回复文本，渲染器负责动画播报，小程序负责稳定展示。'>
            <Textarea
              key={`avatar-message-${textareaResetKey}`}
              className='ke-textarea ke-avatar-textarea'
              placeholder='例如：张奶奶，先喝几口温水，我们再一起看看家人的留言。'
              confirmType='done'
              holdKeyboard={false}
              maxlength={500}
              onInput={(event) => {
                const nextValue = event.detail.value;
                customTextDraftRef.current = nextValue;
                return nextValue;
              }}
              onConfirm={(event) => {
                event.stopPropagation?.();
                setNotice('输入完成后，请点击“发送给数字人”再发送。');
              }}
            />
            <View className='ke-actions' style={{ marginTop: '18rpx' }}>
              <Button
                className='ke-button'
                disabled={busyAction !== null}
                loading={busyAction === 'chat'}
                onClick={() => void handleChat()}
              >
                发送给数字人
              </Button>
              <Button
                className='ke-button--ghost'
                disabled={busyAction !== null || !lastReply}
                onClick={() => void handleSpeak(lastReply)}
              >
                播报最后回复
              </Button>
            </View>
          </SectionCard>

          <SectionCard title='最近对话' caption='这里会把当前本地会话和 Fay 历史记录合并，保持和家属端互动历史一致。'>
            {conversation.length ? (
              <View className='ke-avatar-conversation'>
                {conversation.map((item) => (
                  <View
                    className={`ke-chat-message ${
                      item.role === 'assistant' ? 'ke-chat-message--assistant' : 'ke-chat-message--user'
                    }`}
                    key={item.id}
                  >
                    <View className='ke-chat-message__meta'>
                      <Text>{item.role === 'assistant' ? '数字人' : '我'}</Text>
                      <Text>{item.timeLabel}</Text>
                    </View>
                    <Text className='ke-chat-message__content'>{item.content}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title='还没有新的对话记录' hint='先给数字人发一句话，这里会自动同步最近的互动历史。' />
            )}
          </SectionCard>
        </>
      ) : null}

      {loading ? <Text className='ke-footnote'>正在同步数字人状态...</Text> : null}
    </View>
  );
}
