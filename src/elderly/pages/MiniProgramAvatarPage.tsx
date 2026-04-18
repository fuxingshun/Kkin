import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AvatarStage } from '../components/AvatarStage';
import type { AvatarRuntimeDiagnostics } from '../components/AvatarStage';
import { API_BASE_URL } from '../../config/runtime';

type SDKStatus = 'loading' | 'ready' | 'error' | 'config-missing';
type WSStatus = 'disconnected' | 'connecting' | 'connected';
type BusyAction = 'chat' | 'microphone' | 'speak' | null;
type ConversationRole = 'assistant' | 'user';

interface AvatarActionResponse {
  success?: boolean;
  error?: string;
  audio_url?: string;
  audio_error?: string;
  renderer_command_id?: number | null;
  result?: {
    enabled?: boolean;
    message?: string;
    status_code?: number;
  };
}

interface AvatarChatResponse {
  success?: boolean;
  reply?: string;
  error?: string;
  no_reply?: boolean;
  audio_url?: string;
  audio_error?: string;
  renderer_command_id?: number | null;
}

interface InteractionMessage {
  type: 'fay' | 'member';
  content: string;
  createtime: number;
  way?: string;
}

interface InteractionResponse {
  list?: InteractionMessage[];
  available?: boolean;
  error?: string;
}

interface ConversationItem {
  id: string;
  role: ConversationRole;
  content: string;
  timeLabel: string;
  createdAt: number;
  source: 'local' | 'history';
}

interface AvatarRendererCommand {
  id: number;
  type: string;
  text: string;
  user: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

interface AvatarRendererCommandResponse {
  commands?: AvatarRendererCommand[];
}

const DEFAULT_CHAT_USERNAME = 'User';
const DEFAULT_GREETING = '张奶奶，您好呀，我在这里陪着您。今天我们慢慢聊，不着急。';
const DEFAULT_REMINDER = '到提醒时间了，先喝几口温水，我们再一起看看今天的安排。';

function getSearchValue(key: string, fallback: string) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = new URLSearchParams(window.location.search).get(key);
  return value?.trim() ? value.trim() : fallback;
}

function getStatusTone(status: SDKStatus | WSStatus) {
  if (status === 'ready' || status === 'connected') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'error' || status === 'disconnected' || status === 'config-missing') {
    return 'bg-rose-100 text-rose-700';
  }

  return 'bg-amber-100 text-amber-700';
}

function getStatusText(status: SDKStatus | WSStatus) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'disconnected':
      return 'Disconnected';
    case 'config-missing':
      return 'Config Missing';
    case 'error':
      return 'Error';
    default:
      return 'Loading';
  }
}

function formatConversationTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stripFayDiagnostics(content: string) {
  const normalized = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<prestart[\s\S]*?(?=\n|$)/gi, '')
    .trim();

  const filteredLines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }

      return !/^(stats:|skipped:|reason:|query=|where=|embedding_|persist_dir:|collection:|vectors:|default_corpus_dir:|base_url:|model:)/i.test(
        line
      );
    });

  return filteredLines.join('\n').trim();
}

function sanitizeConversationContent(content: string) {
  const cleaned = stripFayDiagnostics(content);
  return cleaned || content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let payload: T | { error?: string } = {} as T;
  try {
    payload = await response.json();
  } catch (error) {
    payload = {} as T;
  }

  if (!response.ok) {
    const message =
      (payload as { error?: string })?.error || `Request failed: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return payload as T;
}

function getDirectSpeak() {
  return (window as Window & { testXmovSpeak?: (text: string) => void | Promise<void> }).testXmovSpeak;
}

function getPrepareXmovAudio() {
  return (window as Window & { prepareXmovAudio?: () => void | Promise<void> }).prepareXmovAudio;
}

function getMiniProgramBridge() {
  return (window as Window & {
    wx?: {
      miniProgram?: {
        getEnv?: (callback: (result: { miniprogram: boolean }) => void) => void;
        postMessage?: (payload: { data: Record<string, unknown> }) => void;
        navigateBack?: (payload?: { delta?: number }) => void;
      };
    };
  }).wx?.miniProgram;
}

function pushMiniProgramMessage(type: string, payload: Record<string, unknown>) {
  try {
    getMiniProgramBridge()?.postMessage?.({
      data: {
        type,
        ...payload,
      },
    });
  } catch (error) {
    console.warn('[mini-program-avatar] failed to post mini program message', error);
  }
}

function createConversationItem(
  role: ConversationRole,
  content: string,
  createdAt = Date.now(),
  source: ConversationItem['source'] = 'local'
): ConversationItem {
  return {
    id: `${role}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt,
    source,
    timeLabel: formatConversationTime(createdAt),
  };
}

function normalizeConversation(messages: InteractionMessage[]) {
  return messages
    .map((message) => {
      const content = sanitizeConversationContent(message.content || '');
      if (!content) {
        return null;
      }

      const createdAt = message.createtime > 1e12 ? message.createtime : message.createtime * 1000;
      return createConversationItem(
        message.type === 'fay' ? 'assistant' : 'user',
        content,
        createdAt,
        'history'
      );
    })
    .filter((item): item is ConversationItem => Boolean(item))
    .sort((left, right) => right.createdAt - left.createdAt);
}

function mergeConversation(current: ConversationItem[], incoming: ConversationItem[]) {
  const merged = new Map<string, ConversationItem>();

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

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatRuntimeValue(value: string | number | boolean | undefined) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }

  return String(value);
}

type RendererFrameSource = HTMLCanvasElement | HTMLVideoElement;

function isHtmlVideoElement(source: RendererFrameSource): source is HTMLVideoElement {
  return typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement;
}

function getRendererFrameSourceSize(source: RendererFrameSource) {
  if (isHtmlVideoElement(source)) {
    return {
      width: source.videoWidth || source.clientWidth,
      height: source.videoHeight || source.clientHeight,
    };
  }

  return {
    width: source.width || source.clientWidth,
    height: source.height || source.clientHeight,
  };
}

function findRendererFrameSource() {
  const root = document.querySelector('[data-avatar-renderer-root="true"]');
  if (!root) {
    return null;
  }

  const nodes = Array.from(root.querySelectorAll('canvas,video')).filter(
    (node): node is RendererFrameSource =>
      (typeof HTMLCanvasElement !== 'undefined' && node instanceof HTMLCanvasElement) ||
      (typeof HTMLVideoElement !== 'undefined' && node instanceof HTMLVideoElement)
  );

  const candidates = nodes
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const size = getRendererFrameSourceSize(node);
      const isVideoReady = !isHtmlVideoElement(node) || node.readyState >= 2;
      const area = Math.max(rect.width, size.width) * Math.max(rect.height, size.height);

      return {
        node,
        area,
        score: area + (isHtmlVideoElement(node) ? 1000 : 0),
        visible:
          isVideoReady &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity || '1') > 0 &&
          rect.width >= 120 &&
          rect.height >= 180 &&
          size.width > 0 &&
          size.height > 0,
      };
    })
    .filter((candidate) => candidate.visible)
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.node || null;
}

function isRendererFrameBlank(source: RendererFrameSource) {
  const sampleSize = 32;
  const sample = document.createElement('canvas');
  sample.width = sampleSize;
  sample.height = sampleSize;

  const context = sample.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return false;
  }

  try {
    context.drawImage(source, 0, 0, sampleSize, sampleSize);
    const imageData = context.getImageData(0, 0, sampleSize, sampleSize).data;
    let visiblePixels = 0;
    let brightness = 0;

    for (let index = 0; index < imageData.length; index += 4) {
      const alpha = imageData[index + 3];
      const value = imageData[index] + imageData[index + 1] + imageData[index + 2];
      if (alpha > 12 && value > 24) {
        visiblePixels += 1;
        brightness += value;
      }
    }

    const visibleRatio = visiblePixels / (sampleSize * sampleSize);
    return visibleRatio < 0.02 || brightness / Math.max(visiblePixels, 1) < 12;
  } catch (error) {
    return false;
  }
}

async function captureRendererCanvasWithStream(canvas: HTMLCanvasElement) {
  if (typeof canvas.captureStream !== 'function') {
    return '';
  }

  const width = canvas.width || canvas.clientWidth;
  const height = canvas.height || canvas.clientHeight;
  if (!width || !height) {
    return '';
  }

  let stream: MediaStream | null = null;
  const video = document.createElement('video');
  try {
    stream = canvas.captureStream(12);
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    await new Promise<void>((resolve) => {
      const frameCallback = (video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number;
      }).requestVideoFrameCallback;

      if (frameCallback) {
        frameCallback.call(video, () => resolve());
        return;
      }

      window.setTimeout(resolve, 180);
    });

    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const context = output.getContext('2d');
    if (!context) {
      return '';
    }

    context.drawImage(video, 0, 0, width, height);
    if (isRendererFrameBlank(output)) {
      return '';
    }

    return output.toDataURL('image/jpeg', 0.78);
  } catch (error) {
    console.warn('[avatar-renderer] stream capture failed', error);
    return '';
  } finally {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    video.srcObject = null;
  }
}

function captureRendererMediaFrame(source: RendererFrameSource) {
  const { width, height } = getRendererFrameSourceSize(source);
  if (!width || !height || isRendererFrameBlank(source)) {
    return '';
  }

  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d');
  if (!context) {
    return '';
  }

  try {
    context.drawImage(source, 0, 0, width, height);
    if (isRendererFrameBlank(output)) {
      return '';
    }
    return output.toDataURL('image/jpeg', 0.78);
  } catch (error) {
    console.warn('[avatar-renderer] media frame capture failed', error);
    return '';
  }
}

async function captureRendererFrame(source: RendererFrameSource) {
  const directFrame = captureRendererMediaFrame(source);
  if (directFrame) {
    return directFrame;
  }

  if (isHtmlVideoElement(source)) {
    return '';
  }

  const streamedFrame = await captureRendererCanvasWithStream(source);
  if (streamedFrame) {
    return streamedFrame;
  }

  return '';
}

export const MiniProgramAvatarPage: React.FC = () => {
  const elderlyName = getSearchValue('elderName', '张奶奶');
  const stageOnlyMode = getSearchValue('layout', '') === 'stage-only';
  const debugMode = getSearchValue('debug', '') === '1';
  const rendererMode = getSearchValue('source', '') === 'renderer' || getSearchValue('relay', '') === '1';
  const externalFrameCapture =
    getSearchValue('capture', '') === 'electron' || getSearchValue('frameCapture', '') === 'external';
  const [sdkStatus, setSDKStatus] = useState<SDKStatus>('loading');
  const [wsStatus, setWsStatus] = useState<WSStatus>('disconnected');
  const [customText, setCustomText] = useState('');
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [notice, setNotice] = useState(
    rendererMode
      ? '当前页面正作为数字人渲染器运行：负责执行星云播报命令，并把最新画面同步给小程序原生页。'
      : '当前页面直接承载原始星云数字人 H5，语音播报走 XMOV，对话记录走 Fay。'
  );
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [isMiniProgramEnv, setIsMiniProgramEnv] = useState(false);
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<AvatarRuntimeDiagnostics | null>(null);
  const lastReplyRef = useRef('');
  const lastRendererCommandIdRef = useRef(0);
  const lastRendererCommandTypeRef = useRef('');
  const lastRendererCommandTextRef = useRef('');
  const relayUploadingRef = useRef(false);
  const lastFrameFingerprintRef = useRef('');
  const lastFrameUploadedAtRef = useRef(0);

  const lastReply = useMemo(
    () => conversation.find((item) => item.role === 'assistant')?.content || lastReplyRef.current,
    [conversation]
  );

  const runtimeSummary = useMemo(
    () =>
      runtimeDiagnostics
        ? [
            { label: 'Environment', value: runtimeDiagnostics.environment },
            { label: 'Acceleration', value: runtimeDiagnostics.acceleration },
            {
              label: 'Container',
              value: `${runtimeDiagnostics.containerWidth} x ${runtimeDiagnostics.containerHeight}`,
            },
            { label: 'Render nodes', value: runtimeDiagnostics.containerChildCount },
            {
              label: 'WebGL',
              value: `${runtimeDiagnostics.webglSupported ? 'yes' : 'no'} / ${runtimeDiagnostics.webgl2Supported ? 'yes' : 'no'}`,
            },
            { label: 'Audio', value: runtimeDiagnostics.audioContextState },
            {
              label: 'SDK',
              value: `${runtimeDiagnostics.sdkStatus} / ${runtimeDiagnostics.lastSdkState || '-'}`,
            },
            { label: 'Voice', value: runtimeDiagnostics.lastVoiceState || '-' },
            { label: 'Nodes', value: runtimeDiagnostics.renderNodeSummary.join(' | ') || '-' },
          ]
        : [],
    [runtimeDiagnostics]
  );

  useEffect(() => {
    if (lastReply) {
      lastReplyRef.current = lastReply;
    }
  }, [lastReply]);

  const syncConversationFromServer = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    const params = new URLSearchParams({
      username: DEFAULT_CHAT_USERNAME,
      limit: '24',
    });

    try {
      const response = await fetch(`${API_BASE_URL}/family/interactions?${params.toString()}`);
      const payload = (await response.json()) as InteractionResponse;

      if (!response.ok) {
        throw new Error(payload.error || `Request failed: ${response.status} ${response.statusText}`);
      }

      const historyItems = normalizeConversation(payload.list || []);
      let mergedConversation: ConversationItem[] = historyItems;

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

      if (!silent && payload.available === false && payload.error) {
        setNotice(payload.error);
      }

      return mergedConversation;
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : '最近对话同步失败';
        setNotice(message);
      }

      return [] as ConversationItem[];
    }
  }, []);

  const waitForConversationSync = useCallback(
    async (startedAt: number) => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const mergedConversation = await syncConversationFromServer({ silent: true });
        const latestAssistant = mergedConversation.find(
          (item) => item.role === 'assistant' && item.createdAt >= startedAt - 2000
        );

        if (latestAssistant) {
          lastReplyRef.current = latestAssistant.content;
          return latestAssistant;
        }

        await sleep(800);
      }

      return null;
    },
    [syncConversationFromServer]
  );

  const pushRendererStatus = useCallback(
    async (overrides: Record<string, unknown> = {}) => {
      if (!rendererMode) {
        return;
      }

      try {
        await postJson(`${API_BASE_URL}/elderly/avatar/renderer/status`, {
          sdk_status: sdkStatus,
          ws_status: wsStatus,
          environment: runtimeDiagnostics?.environment || 'browser-renderer',
          acceleration: runtimeDiagnostics?.acceleration || '',
          render_nodes: runtimeDiagnostics?.containerChildCount || 0,
          audio_state: runtimeDiagnostics?.audioContextState || '',
          last_voice_state: runtimeDiagnostics?.lastVoiceState || '',
          last_notice: notice,
          last_error: runtimeDiagnostics?.lastError || '',
          last_command_id: lastRendererCommandIdRef.current,
          last_command_type: lastRendererCommandTypeRef.current,
          last_command_text: lastRendererCommandTextRef.current,
          last_audio_url: runtimeDiagnostics?.lastAudioUrl || '',
          last_audio_text: runtimeDiagnostics?.lastAudioText || '',
          last_audio_at: runtimeDiagnostics?.lastAudioAt || '',
          ...overrides,
        });
      } catch (error) {
        console.warn('[avatar-renderer] failed to push runtime status', error);
      }
    },
    [notice, rendererMode, runtimeDiagnostics, sdkStatus, wsStatus]
  );

  const uploadRendererFrame = useCallback(async () => {
    if (!rendererMode || relayUploadingRef.current) {
      return;
    }

    const frameSource = findRendererFrameSource();
    if (!frameSource) {
      await pushRendererStatus({ last_error: 'renderer frame source is not ready' });
      return;
    }

    relayUploadingRef.current = true;

    try {
      const dataUrl = await captureRendererFrame(frameSource);
      if (!dataUrl) {
        await pushRendererStatus({ last_error: 'renderer frame is blank; skipped uploading black frame' });
        return;
      }

      const fingerprint = `${dataUrl.length}:${dataUrl.slice(-160)}`;
      const now = Date.now();

      if (
        fingerprint === lastFrameFingerprintRef.current &&
        now - lastFrameUploadedAtRef.current < 3500
      ) {
        return;
      }

      await postJson(`${API_BASE_URL}/elderly/avatar/renderer/frame`, {
        frame: dataUrl,
        width: runtimeDiagnostics?.containerWidth || getRendererFrameSourceSize(frameSource).width,
        height: runtimeDiagnostics?.containerHeight || getRendererFrameSourceSize(frameSource).height,
        text: lastReplyRef.current || '',
        speaking: busyAction === 'speak' || busyAction === 'chat',
      });

      lastFrameFingerprintRef.current = fingerprint;
      lastFrameUploadedAtRef.current = now;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'frame upload failed';
      console.warn('[avatar-renderer] failed to upload frame', error);
      await pushRendererStatus({ last_error: message });
    } finally {
      relayUploadingRef.current = false;
    }
  }, [busyAction, pushRendererStatus, rendererMode, runtimeDiagnostics]);

  const executeRendererCommand = useCallback(
    async (command: AvatarRendererCommand) => {
      lastRendererCommandIdRef.current = command.id;
      lastRendererCommandTypeRef.current = command.type;
      lastRendererCommandTextRef.current = command.text || '';

      if (command.type === 'speak' && command.text?.trim()) {
        const directSpeak = getDirectSpeak();
        if (typeof directSpeak === 'function') {
          directSpeak(command.text);
          setNotice(`渲染器正在执行播报：${command.text}`);
          await pushRendererStatus({
            last_command_id: command.id,
            last_command_type: command.type,
            last_command_text: command.text,
            last_notice: command.text,
          });
          return;
        }

        const message = 'XMOV direct speak bridge is unavailable';
        setNotice(message);
        await pushRendererStatus({
          last_command_id: command.id,
          last_command_type: command.type,
          last_command_text: command.text,
          last_error: message,
        });
        return;
      }

      await pushRendererStatus({
        last_command_id: command.id,
        last_command_type: command.type,
        last_command_text: command.text || '',
      });
    },
    [pushRendererStatus]
  );

  useEffect(() => {
    document.title = `${elderlyName} - 数字人陪伴`;
  }, [elderlyName]);

  useEffect(() => {
    getMiniProgramBridge()?.getEnv?.((result) => {
      setIsMiniProgramEnv(result.miniprogram === true);
    });
  }, []);

  useEffect(() => {
    pushMiniProgramMessage('avatar-status', {
      sdkStatus,
      wsStatus,
    });
  }, [sdkStatus, wsStatus]);

  useEffect(() => {
    void syncConversationFromServer();

    const timer = window.setInterval(() => {
      void syncConversationFromServer({ silent: true });
    }, 8000);

    return () => {
      window.clearInterval(timer);
    };
  }, [syncConversationFromServer]);

  useEffect(() => {
    if (!rendererMode) {
      return;
    }

    let cancelled = false;

    const pollRendererCommands = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/elderly/avatar/renderer/commands?after_id=${lastRendererCommandIdRef.current}&limit=8`
        );
        const payload = (await response.json()) as AvatarRendererCommandResponse;
        if (!response.ok) {
          throw new Error(`renderer command poll failed: ${response.status}`);
        }

        const commands = (payload.commands || []).slice().sort((left, right) => left.id - right.id);
        for (const command of commands) {
          if (cancelled) {
            return;
          }
          await executeRendererCommand(command);
        }
      } catch (error) {
        console.warn('[avatar-renderer] failed to poll commands', error);
      }
    };

    void pushRendererStatus();
    void pollRendererCommands();
    if (!externalFrameCapture) {
      void uploadRendererFrame();
    }

    const commandTimer = window.setInterval(() => {
      void pollRendererCommands();
    }, 1200);

    const frameTimer = externalFrameCapture
      ? null
      : window.setInterval(() => {
          void uploadRendererFrame();
        }, 500);

    const statusTimer = window.setInterval(() => {
      void pushRendererStatus();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(commandTimer);
      if (frameTimer !== null) {
        window.clearInterval(frameTimer);
      }
      window.clearInterval(statusTimer);
    };
  }, [executeRendererCommand, externalFrameCapture, pushRendererStatus, rendererMode, uploadRendererFrame]);

  async function handleDirectSpeak(text: string) {
    const content = text.trim();
    if (!content) {
      setNotice('请先输入一段想让数字人播报的内容。');
      return;
    }

    const directSpeak = getDirectSpeak();
    if (typeof directSpeak !== 'function') {
      setNotice('星云数字人还没完全准备好，请稍后再试。');
      return;
    }

    try {
      setBusyAction('speak');
      await directSpeak(content);
      setNotice('已经触发数字人直播放音。');
      setCustomText('');
      pushMiniProgramMessage('avatar-direct-speak', { text: content });
    } catch (error) {
      const message = error instanceof Error ? error.message : '数字人播报失败';
      setNotice(message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleChat() {
    const content = customText.trim();
    if (!content) {
      setNotice('请先输入一句想对数字人说的话。');
      return;
    }

    const startedAt = Date.now();
    const userItem = createConversationItem('user', content, startedAt, 'local');

    try {
      setBusyAction('chat');
      setConversation((current) => mergeConversation(current, [userItem]));
      setNotice('正在通过 Fay 生成回复...');
      setCustomText('');

      const prepareXmovAudio = getPrepareXmovAudio();
      if (typeof prepareXmovAudio === 'function') {
        await prepareXmovAudio();
      }

      const payload = await postJson<AvatarChatResponse>(`${API_BASE_URL}/elderly/avatar/chat`, {
        user: DEFAULT_CHAT_USERNAME,
        message: content,
      });

      const directReply = sanitizeConversationContent((payload.reply || '').trim());
      if (directReply) {
        const assistantItem = createConversationItem('assistant', directReply, Date.now(), 'local');
        lastReplyRef.current = directReply;
        setConversation((current) => mergeConversation(current, [assistantItem]));
        setNotice(directReply);
        pushMiniProgramMessage('avatar-chat-reply', { reply: directReply });

        if (!rendererMode) {
          const directSpeak = getDirectSpeak();
          if (typeof directSpeak === 'function') {
            await directSpeak(directReply);
          }
        }
      }

      const syncedAssistant = await waitForConversationSync(startedAt);
      if (syncedAssistant) {
        setNotice(syncedAssistant.content);
        if (!directReply || directReply !== syncedAssistant.content) {
          pushMiniProgramMessage('avatar-chat-reply', { reply: syncedAssistant.content });
        }
        return;
      }

      if (!directReply) {
        setNotice('Fay 已收到消息，最近对话会在下一次同步后刷新。');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fay 对话失败';
      setNotice(message);
      pushMiniProgramMessage('avatar-chat-error', { message });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleMicrophone(nextEnabled: boolean) {
    try {
      setBusyAction('microphone');
      setNotice(nextEnabled ? '正在开启麦克风...' : '正在关闭麦克风...');
      const payload = await postJson<AvatarActionResponse>(`${API_BASE_URL}/elderly/avatar/microphone`, {
        enabled: nextEnabled,
      });
      const enabled = payload.result?.enabled ?? nextEnabled;
      setMicrophoneEnabled(enabled);
      setNotice(enabled ? '麦克风已开启。' : '麦克风已关闭。');
      pushMiniProgramMessage('avatar-microphone', { enabled });
    } catch (error) {
      const message = error instanceof Error ? error.message : '麦克风切换失败';
      setNotice(message);
    } finally {
      setBusyAction(null);
    }
  }

  if (stageOnlyMode) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff8ef_0%,#ffe9cf_100%)] text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4 md:p-6">
          <section className="rounded-[32px] border border-[#e8d5c1] bg-white/85 p-5 shadow-[0_24px_80px_rgba(93,52,27,0.14)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex rounded-full bg-[#f9ead9] px-4 py-2 text-sm font-semibold text-[#a44b27]">
                  Digital Human
                </span>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#2b1d15]">{elderlyName} 的数字人陪伴</h1>
                <p className="mt-2 text-sm leading-7 text-[#765d4c]">
                  这是一张独立测试页，只保留数字人舞台和最基础的控制，用来排除是不是原页面布局影响了渲染。
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusTone(sdkStatus)}`}>
                星云 SDK {getStatusText(sdkStatus)}
              </span>
              <span className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusTone(wsStatus)}`}>
                Fay WS {getStatusText(wsStatus)}
              </span>
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  microphoneEnabled ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                麦克风 {microphoneEnabled ? '已开启' : '已关闭'}
              </span>
            </div>
            <div className="mt-4 rounded-3xl bg-[#fff8ef] px-4 py-3 text-sm leading-6 text-[#765d4c]">{notice}</div>
            {debugMode && runtimeDiagnostics ? (
              <div className="mt-4 rounded-3xl border border-[#e8d5c1] bg-[#fffdf9] px-4 py-4">
                <div className="text-sm font-semibold text-[#2b1d15]">Runtime diagnostics</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {runtimeSummary.map((item) => (
                    <div key={item.label} className="rounded-2xl bg-[#fff8ef] px-3 py-3 text-sm leading-6 text-[#5f3b24]">
                      <div className="text-xs uppercase tracking-[0.12em] text-[#a07155]">{item.label}</div>
                      <div className="mt-1 break-all font-medium text-[#2b1d15]">{formatRuntimeValue(item.value)}</div>
                    </div>
                  ))}
                </div>
                {runtimeDiagnostics.sdkStatus === 'ready' && runtimeDiagnostics.containerChildCount === 0 ? (
                  <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-3 text-sm leading-6 text-rose-700">
                    XMOV is marked ready, but the stage still has 0 render nodes. That usually means the SDK did not attach its
                    canvas or video layers inside the current web-view runtime.
                  </div>
                ) : null}
                {runtimeDiagnostics.lastError ? (
                  <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-700">
                    Last error: {runtimeDiagnostics.lastError}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-[36px] border border-[#e8d5c1] bg-white/82 p-4 shadow-[0_24px_80px_rgba(93,52,27,0.14)]">
            <div className="overflow-hidden rounded-[30px] border border-[#e8d5c1] bg-[#120d08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="h-[68vh] min-h-[520px] w-full">
                <AvatarStage
                  onSDKStatusChange={setSDKStatus}
                  onWSStatusChange={setWsStatus}
                  onDiagnosticsChange={setRuntimeDiagnostics}
                />
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-[#e8d5c1] bg-white/82 p-5 shadow-[0_20px_60px_rgba(93,52,27,0.12)]">
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                className="rounded-2xl bg-[#d96b3b] px-4 py-4 text-left text-base font-semibold text-white transition hover:bg-[#c65c31]"
                onClick={() => void handleDirectSpeak(DEFAULT_GREETING)}
                disabled={busyAction !== null}
              >
                试播欢迎词
              </button>
              <button
                type="button"
                className="rounded-2xl bg-[#f7e7d4] px-4 py-4 text-left text-base font-semibold text-[#8a4425] transition hover:bg-[#f1dcc4]"
                onClick={() => void handleDirectSpeak(DEFAULT_REMINDER)}
                disabled={busyAction !== null}
              >
                试播提醒词
              </button>
              <button
                type="button"
                className="rounded-2xl bg-[#eef4ff] px-4 py-4 text-left text-base font-semibold text-[#27537d] transition hover:bg-[#dfeafc]"
                onClick={() => void handleToggleMicrophone(!microphoneEnabled)}
                disabled={busyAction !== null}
              >
                {microphoneEnabled ? '关闭麦克风' : '开启麦克风'}
              </button>
              {isMiniProgramEnv ? (
                <button
                  type="button"
                  className="rounded-2xl bg-[#2b1d15] px-4 py-4 text-left text-base font-semibold text-white transition hover:bg-[#1d130d]"
                  onClick={() => getMiniProgramBridge()?.navigateBack?.({ delta: 1 })}
                >
                  返回小程序
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,214,176,0.38),_transparent_34%),linear-gradient(180deg,#fffaf3_0%,#fff1e0_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 md:p-6">
        <section className="rounded-[32px] border border-[#e8d5c1] bg-white/80 p-5 shadow-[0_24px_80px_rgba(93,52,27,0.12)] backdrop-blur md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full bg-[#f9ead9] px-4 py-2 text-sm font-semibold text-[#a44b27]">
                XMOV Direct
              </span>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#2b1d15] md:text-4xl">
                {elderlyName} 的数字人陪伴页
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#765d4c] md:text-base">
                小程序企业版这里直接承载星云数字人 H5。现在这页的重点是三件事：先让数字人本体稳定显示，
                再保证 Fay 对话能播出来，最后把最近对话和家属端互动历史保持一致。
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
              <span className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusTone(sdkStatus)}`}>
                星云 SDK {getStatusText(sdkStatus)}
              </span>
              <span className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusTone(wsStatus)}`}>
                Fay WS {getStatusText(wsStatus)}
              </span>
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  microphoneEnabled ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                麦克风 {microphoneEnabled ? '已开启' : '已关闭'}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-3xl bg-[#fff8ef] px-4 py-3 text-sm leading-6 text-[#765d4c]">{notice}</div>
          {isMiniProgramEnv ? (
            <div className="mt-3 rounded-3xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
              当前运行在小程序 web-view 环境中，这里展示的就是企业版小程序里真正承载数字人的页面。
            </div>
          ) : null}
        </section>

        <section className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <div className="flex flex-col gap-4">
            <section className="rounded-[36px] border border-[#e8d5c1] bg-white/82 p-4 shadow-[0_24px_80px_rgba(93,52,27,0.14)]">
              <div className="flex items-center justify-between gap-3 px-2 pb-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#2b1d15]">数字人舞台</h2>
                  <p className="mt-1 text-sm leading-6 text-[#765d4c]">
                    这块现在会优先把数字人舞台放到首屏，方便直接确认“人像是否真的出来了”。
                  </p>
                </div>
                <span className="rounded-full bg-[#f9ead9] px-3 py-1 text-xs font-semibold text-[#a44b27]">
                  首屏可见
                </span>
              </div>
              <div className="overflow-hidden rounded-[30px] border border-[#e8d5c1] bg-[#120d08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div className="h-[54vh] min-h-[420px] w-full">
                  <AvatarStage
                    onSDKStatusChange={setSDKStatus}
                    onWSStatusChange={setWsStatus}
                    onDiagnosticsChange={setRuntimeDiagnostics}
                  />
                </div>
              </div>
            </section>

            {debugMode && runtimeDiagnostics ? (
              <section className="rounded-[32px] border border-[#e8d5c1] bg-white/82 p-5 shadow-[0_20px_60px_rgba(93,52,27,0.12)]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-[#2b1d15]">Runtime diagnostics</h2>
                  <span className="rounded-full bg-[#f7e7d4] px-3 py-2 text-xs font-semibold text-[#8a4425]">
                    live
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {runtimeSummary.map((item) => (
                    <div key={item.label} className="rounded-2xl bg-[#fff8ef] px-4 py-3 text-sm leading-6 text-[#5f3b24]">
                      <div className="text-xs uppercase tracking-[0.12em] text-[#a07155]">{item.label}</div>
                      <div className="mt-1 break-all font-medium text-[#2b1d15]">{formatRuntimeValue(item.value)}</div>
                    </div>
                  ))}
                </div>
                {runtimeDiagnostics.sdkStatus === 'ready' && runtimeDiagnostics.containerChildCount === 0 ? (
                  <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                    XMOV is marked ready, but the stage still has 0 render nodes. That usually means the SDK did not attach its
                    canvas or video layers inside the current web-view runtime.
                  </div>
                ) : null}
                {runtimeDiagnostics.lastError ? (
                  <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
                    Last error: {runtimeDiagnostics.lastError}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-[32px] border border-[#e8d5c1] bg-white/82 p-5 shadow-[0_20px_60px_rgba(93,52,27,0.12)]">
              <h2 className="text-xl font-semibold text-[#2b1d15]">快速验证</h2>
              <p className="mt-2 text-sm leading-6 text-[#765d4c]">
                这里用来验证星云数字人的直接播报能力，不走镜像，也不依赖占位头像。
              </p>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  className="rounded-2xl bg-[#d96b3b] px-4 py-4 text-left text-base font-semibold text-white transition hover:bg-[#c65c31]"
                  onClick={() => void handleDirectSpeak(DEFAULT_GREETING)}
                  disabled={busyAction !== null}
                >
                  试播欢迎词
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-[#f7e7d4] px-4 py-4 text-left text-base font-semibold text-[#8a4425] transition hover:bg-[#f1dcc4]"
                  onClick={() => void handleDirectSpeak(DEFAULT_REMINDER)}
                  disabled={busyAction !== null}
                >
                  试播提醒词
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-[#eef4ff] px-4 py-4 text-left text-base font-semibold text-[#27537d] transition hover:bg-[#dfeafc]"
                  onClick={() => void handleToggleMicrophone(!microphoneEnabled)}
                  disabled={busyAction !== null}
                >
                  {microphoneEnabled ? '关闭麦克风' : '开启麦克风'}
                </button>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4">
            <section className="rounded-[32px] border border-[#e8d5c1] bg-white/82 p-5 shadow-[0_20px_60px_rgba(93,52,27,0.12)]">
              <h2 className="text-xl font-semibold text-[#2b1d15]">通过 Fay 对话</h2>
              <p className="mt-2 text-sm leading-6 text-[#765d4c]">
                在这里输入一句话，请求会先进入 Fay，再由 XMOV 数字人播报返回内容。
              </p>
              <textarea
                className="mt-4 h-40 w-full rounded-3xl border border-[#e7d1bc] bg-[#fffaf5] px-4 py-4 text-base text-[#2b1d15] outline-none transition focus:border-[#d96b3b] focus:ring-2 focus:ring-[#f3ceb5]"
                placeholder="例如：张奶奶，先喝几口温水，我们再一起看看家人的留言。"
                value={customText}
                onChange={(event) => setCustomText(event.target.value)}
              />
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[#2b1d15] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#1d130d]"
                  onClick={() => void handleChat()}
                  disabled={busyAction !== null}
                >
                  {busyAction === 'chat' ? '对话中...' : '发送给数字人'}
                </button>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[#f7e7d4] px-4 py-4 text-base font-semibold text-[#8a4425] transition hover:bg-[#f1dcc4]"
                  onClick={() => void handleDirectSpeak(lastReply)}
                  disabled={busyAction !== null || !lastReply}
                >
                  播报最后回复
                </button>
                {isMiniProgramEnv ? (
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-[#eef4ff] px-4 py-4 text-base font-semibold text-[#27537d] transition hover:bg-[#dfeafc]"
                    onClick={() => getMiniProgramBridge()?.navigateBack?.({ delta: 1 })}
                  >
                    返回小程序
                  </button>
                ) : null}
              </div>
            </section>

            <section className="rounded-[32px] border border-[#e8d5c1] bg-white/82 p-5 shadow-[0_20px_60px_rgba(93,52,27,0.12)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-[#2b1d15]">最近对话</h2>
                <button
                  type="button"
                  className="rounded-full bg-[#f7e7d4] px-3 py-2 text-xs font-semibold text-[#8a4425] transition hover:bg-[#f1dcc4]"
                  onClick={() => {
                    void syncConversationFromServer();
                  }}
                >
                  立即同步
                </button>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#765d4c]">
                这里会把当前页本地会话和 Fay 历史记录合并，保证和家属端看到的互动历史保持一致。
              </p>
              <div className="mt-4 flex max-h-[320px] flex-col gap-3 overflow-auto">
                {conversation.length ? (
                  conversation.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                        item.role === 'assistant'
                          ? 'bg-[#fff3e5] text-[#5f3b24]'
                          : 'bg-[#f1f7ff] text-[#21415f]'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs opacity-70">
                        <span>{item.role === 'assistant' ? '数字人' : '我'}</span>
                        <span>{item.timeLabel}</span>
                      </div>
                      <div>{item.content}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-[#fff8ef] px-4 py-4 text-sm leading-6 text-[#765d4c]">
                    还没有新的对话记录。你可以先发送一句话给数字人，验证 Fay 和星云链路。
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
};
