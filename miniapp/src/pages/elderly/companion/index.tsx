import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { Button, Input, ScrollView, Text, View } from '@tarojs/components';
import { chatWithAi, voiceChatWithAi } from '@/services/aiCompanion';
import { getAiInteractions, type AiInteraction } from '@/services/elderly';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';

type RecorderStopResult = {
  tempFilePath?: string;
  duration?: number;
  fileSize?: number;
};

const quickTopics = ['我有点难过', '想聊聊天', '想联系家人', '讲讲过去的事', '想听安慰', '睡不着觉'];

const defaultMessages: AiInteraction[] = [
  {
    id: 1,
    username: '小心',
    type: 'ai',
    content: '张阿姨，您好！我是您的AI陪伴助手小心。今天感觉怎么样？',
    createtime: Date.now() - 8 * 60 * 1000,
  },
  {
    id: 2,
    username: 'User',
    type: 'member',
    content: '今天天气不错，心情还可以。',
    createtime: Date.now() - 6 * 60 * 1000,
  },
  {
    id: 3,
    username: '小心',
    type: 'ai',
    content: '那真是太好了！天气好的时候，可以到阳台晒晒太阳，对身体很好。您今天有什么想聊的吗？',
    createtime: Date.now() - 6 * 60 * 1000,
  },
];

function formatMessageTime(value?: number | string) {
  if (!value) {
    return '';
  }

  const timestamp = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(timestamp)) {
    return '';
  }

  const normalized = timestamp > 1e12 ? timestamp : timestamp * 1000;
  return new Date(normalized).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMessageTimestamp(item: AiInteraction) {
  const value = item.createtime;
  if (!value) {
    return 0;
  }

  const timestamp = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return timestamp > 1e12 ? timestamp : timestamp * 1000;
}

function sortMessagesByTime(items: AiInteraction[]) {
  return items
    .slice()
    .sort((left, right) => {
      const timeDiff = getMessageTimestamp(left) - getMessageTimestamp(right);
      if (timeDiff !== 0) {
        return timeDiff;
      }

      return (left.id || 0) - (right.id || 0);
    });
}

export default function ElderlyCompanionPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<AiInteraction[]>([]);
  const [sending, setSending] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showQuickTopics, setShowQuickTopics] = useState(true);
  const [chatScrollTop, setChatScrollTop] = useState(0);
  const audioContextRef = useRef<Taro.InnerAudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const audioPlayingRef = useRef(false);
  const recorderManagerRef = useRef<any>(null);
  const sendingRef = useRef(false);
  const voiceRecordingRef = useRef(false);
  const voiceRecordingStartedAtRef = useRef(0);

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
      console.warn('[elderly-companion] audio play failed', error);
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
      console.warn('[elderly-companion] audio queue item failed', error);
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

  const playAudio = useCallback((url: string) => {
    if (!url) {
      return;
    }

    audioQueueRef.current.push(url);
    playNextAudio();
  }, [playNextAudio]);

  const loadHistory = useCallback(async () => {
    try {
      const history = await getAiInteractions(30);
      setMessages(sortMessagesByTime(history));
    } catch (error) {
      const message = error instanceof Error ? error.message : '对话加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, []);

  useDidShow(() => {
    void loadHistory();
  });

  const visibleMessages = useMemo(() => {
    return messages.length ? messages : defaultMessages;
  }, [messages]);

  const latestMessage = visibleMessages[visibleMessages.length - 1];
  const scrollToLatestMessage = useCallback(() => {
    setTimeout(() => {
      setChatScrollTop((value) => value + 10000);
    }, 50);
  }, []);

  useEffect(() => {
    scrollToLatestMessage();
  }, [
    latestMessage?.content,
    latestMessage?.createtime,
    latestMessage?.id,
    sending,
    showQuickTopics,
    visibleMessages.length,
    scrollToLatestMessage,
  ]);

  const appendMessage = useCallback((message: AiInteraction) => {
    setMessages((prev) => sortMessagesByTime([...prev, message]));
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || sendingRef.current) return;

    try {
      sendingRef.current = true;
      setSending(true);
      appendMessage({
        id: Date.now(),
        username: 'User',
        type: 'member',
        content,
        createtime: Date.now(),
      });

      const result = await chatWithAi(content);
      if (result.reply) {
        appendMessage({
          id: Date.now() + 1,
          username: '小心',
          type: 'ai',
          content: result.reply,
          createtime: Date.now(),
        });
      }

      if (result.audioUrl) {
        playAudio(result.audioUrl);
      } else if (result.audioError) {
        console.warn('[elderly-companion] chat audio unavailable', result.audioError);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '发送失败';
      Taro.showToast({ title: message, icon: 'none' });
      appendMessage({
        id: Date.now() + 2,
        username: '小心',
        type: 'ai',
        content: '我这边连接有点不稳定，但我还在。您可以先慢慢说，我会继续陪您记录。',
        createtime: Date.now(),
      });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [appendMessage, playAudio]);

  const sendVoiceFile = useCallback(async (filePath: string, duration = 0) => {
    if (!filePath) {
      Taro.showToast({ title: '录音文件为空', icon: 'none' });
      return;
    }

    if (duration > 0 && duration < 500) {
      Taro.showToast({ title: '说话时间太短，请再说一次', icon: 'none' });
      return;
    }

    if (sendingRef.current) {
      return;
    }

    try {
      sendingRef.current = true;
      setSending(true);
      Taro.showLoading({ title: '正在识别' });

      const result = await voiceChatWithAi(filePath);
      Taro.hideLoading();

      if (result.transcript) {
        appendMessage({
          id: Date.now(),
          username: 'User',
          type: 'member',
          content: result.transcript,
          createtime: Date.now(),
        });
      }

      if (result.reply) {
        appendMessage({
          id: Date.now() + 1,
          username: '小心',
          type: 'ai',
          content: result.reply,
          createtime: Date.now(),
        });
      }

      if (!result.transcript && !result.reply) {
        appendMessage({
          id: Date.now() + 2,
          username: '小心',
          type: 'ai',
          content: '我刚才没有听清楚。您可以再说一遍，也可以点下面的文字输入。',
          createtime: Date.now(),
        });
      }

      if (result.audioUrl) {
        playAudio(result.audioUrl);
      } else if (result.audioError) {
        console.warn('[elderly-companion] voice chat audio unavailable', result.audioError);
      }
    } catch (error) {
      Taro.hideLoading();
      const message = error instanceof Error ? error.message : '语音发送失败';
      Taro.showToast({ title: message, icon: 'none' });
      appendMessage({
        id: Date.now() + 3,
        username: '小心',
        type: 'ai',
        content: '语音暂时没有识别成功。您先别着急，可以再录一次，或者直接打字给我。',
        createtime: Date.now(),
      });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [appendMessage, playAudio]);

  useEffect(() => {
    const recorderManager = Taro.getRecorderManager();
    recorderManagerRef.current = recorderManager;

    recorderManager.onStart(() => {
      voiceRecordingRef.current = true;
      voiceRecordingStartedAtRef.current = Date.now();
      setIsListening(true);
    });

    recorderManager.onStop((result: RecorderStopResult) => {
      const fallbackDuration = voiceRecordingStartedAtRef.current > 0 ? Date.now() - voiceRecordingStartedAtRef.current : 0;
      voiceRecordingRef.current = false;
      voiceRecordingStartedAtRef.current = 0;
      setIsListening(false);
      void sendVoiceFile(result.tempFilePath || '', result.duration || fallbackDuration);
    });

    recorderManager.onError((error: { errMsg?: string }) => {
      voiceRecordingRef.current = false;
      voiceRecordingStartedAtRef.current = 0;
      setIsListening(false);
      Taro.showToast({ title: error.errMsg || '录音失败', icon: 'none' });
    });
  }, [sendVoiceFile]);

  useEffect(() => {
    return () => {
      if (voiceRecordingRef.current) {
        try {
          recorderManagerRef.current?.stop();
        } catch (error) {
          console.warn('[elderly-companion] recorder cleanup failed', error);
        }
      }
    };
  }, []);

  useDidHide(() => {
    if (voiceRecordingRef.current) {
      try {
        recorderManagerRef.current?.stop();
      } catch (error) {
        console.warn('[elderly-companion] recorder stop on hide failed', error);
      }
    }
  });

  const statusText = isListening ? '正在录音' : sending ? '正在回复' : isSpeaking ? '播报中' : '在线';
  const canSend = inputValue.trim().length > 0 && !sending;

  async function sendInputMessage() {
    const content = inputValue.trim();
    if (!content || sending) {
      return;
    }

    setInputValue('');
    await sendMessage(content);
  }

  async function ensureRecordPermission() {
    try {
      await Taro.authorize({ scope: 'scope.record' });
      return true;
    } catch (error) {
      const modal = await Taro.showModal({
        title: '需要录音权限',
        content: '请允许录音权限，才能把您说的话发送给小心。',
        confirmText: '去设置',
      });
      if (modal.confirm) {
        await Taro.openSetting();
      }
      return false;
    }
  }

  async function startVoiceRecording() {
    if (sendingRef.current) {
      Taro.showToast({ title: '正在回复，请稍等', icon: 'none' });
      return;
    }

    if (voiceRecordingRef.current) {
      return;
    }

    const authorized = await ensureRecordPermission();
    if (!authorized) {
      return;
    }

    try {
      voiceRecordingRef.current = true;
      setIsListening(true);
      recorderManagerRef.current?.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3',
      });
    } catch (error) {
      voiceRecordingRef.current = false;
      setIsListening(false);
      const message = error instanceof Error ? error.message : '录音启动失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  function stopVoiceRecording() {
    if (!voiceRecordingRef.current) {
      setIsListening(false);
      return;
    }

    try {
      recorderManagerRef.current?.stop();
    } catch (error) {
      voiceRecordingRef.current = false;
      setIsListening(false);
      const message = error instanceof Error ? error.message : '录音结束失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  function handleVoiceClick() {
    if (voiceRecordingRef.current) {
      stopVoiceRecording();
    } else {
      void startVoiceRecording();
    }
  }

  return (
    <View className={`ef-chat-page ${preferenceClassName}`}>
      <View className='ef-companion-topbar'>
        <Text className='ef-topbar__back' onClick={() => Taro.redirectTo({ url: '/pages/elderly/home/index' })}>
          ‹
        </Text>

        <View className='ef-chat-header'>
          <View className='ef-header-avatar'>
            <Text>👵</Text>
          </View>
          <View className='ef-header-main'>
            <Text className='ef-header-name'>小心</Text>
            <View className='ef-header-status'>
              <Text className='ef-online__dot' />
              <Text>{statusText}</Text>
            </View>
          </View>
        </View>

        <Text className='ef-topbar__action' onClick={loadHistory}>⋯</Text>
      </View>

      <ScrollView className='ef-chat-list' scrollTop={chatScrollTop} scrollWithAnimation scrollY>
        <View className='ef-chat-list__inner'>
          {visibleMessages.map((item, index) => {
            const isUser = item.type === 'member';
            return (
              <View className={`ef-chat-row ${isUser ? 'ef-chat-row--user' : ''}`} key={`${item.id}-${index}`}>
                <View className={`ef-chat-avatar ${isUser ? 'ef-chat-avatar--user' : ''}`}>
                  <Text>{isUser ? '👤' : '👵'}</Text>
                </View>
                <View className={`ef-chat-bubble-wrap ${isUser ? 'ef-chat-bubble-wrap--user' : ''}`}>
                  <View className={`ef-chat-bubble ${isUser ? 'ef-chat-bubble--user' : ''}`}>
                    <Text>{item.content}</Text>
                  </View>
                  <Text className='ef-chat-time'>{item.timetext || formatMessageTime(item.createtime)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {showQuickTopics ? (
        <View className='ef-topic-panel'>
          <View className='ef-topic-head'>
            <Text className='ef-topic-title'>快捷话题</Text>
            <Text className='ef-topic-toggle' onClick={() => setShowQuickTopics(false)}>收起</Text>
          </View>
          <View className='ef-topic-scroll'>
            {quickTopics.map((topic) => (
              <Text className='ef-topic-chip' key={topic} onClick={() => sendMessage(topic)}>
                {topic}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <View className='ef-voice-panel'>
        <View className='ef-companion-input-row'>
          <Button
            className={`ef-voice-toggle ${isListening ? 'ef-voice-toggle--active' : ''}`}
            onClick={handleVoiceClick}
          >
            <Text>{isListening ? '停' : '麦'}</Text>
          </Button>

          <Input
            className='ef-companion-input'
            confirmType='send'
            placeholder='说点什么...'
            type='text'
            value={inputValue}
            onConfirm={() => void sendInputMessage()}
            onInput={(event) => {
              const nextValue = event.detail.value;
              setInputValue(nextValue);
              return nextValue;
            }}
          />

          <Button
            className={`ef-companion-send ${canSend ? 'ef-companion-send--active' : ''}`}
            disabled={!canSend}
            loading={sending}
            onClick={() => void sendInputMessage()}
          >
            <Text>发</Text>
          </Button>
        </View>

        {isListening ? (
          <View className='ef-recording-tip'>
            <Text className='ef-recording-dot' />
            <Text>正在录音，松开发送</Text>
          </View>
        ) : null}

        {!showQuickTopics ? (
          <Text className='ef-topic-restore' onClick={() => setShowQuickTopics(true)}>显示快捷话题</Text>
        ) : null}
      </View>
    </View>
  );
}
