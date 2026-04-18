import React, { useEffect, useRef, useState } from 'react';
import { loadXmovSDK, isXmovSDKLoaded } from '../utils/sdkLoader';
import { getXmovConfig, isXmovConfigValid } from '../services/xmovConfig';
import { WebSocketService, WebSocketMessage } from '../services/websocketService';
import { FAY_WS_URL } from '../../config/runtime';
import type { XmovAvatarSDK } from '../types/xmov';

interface XmovAvatarProps {
  isActive?: boolean;
  websocketUrl?: string;
  onSDKReady?: () => void;
  onSDKError?: (error: unknown) => void;
  onSpeaking?: (isSpeaking: boolean) => void;
  onSDKStatusChange?: (status: 'loading' | 'ready' | 'error' | 'config-missing') => void;
  onWSStatusChange?: (status: 'disconnected' | 'connecting' | 'connected') => void;
  onLogMessage?: (message: string) => void;
  onIdleStateChange?: (isIdle: boolean) => void;
  onDiagnosticsChange?: (diagnostics: AvatarRuntimeDiagnostics) => void;
  idleTimeout?: number;
  resetIdleTrigger?: number;
}

type SDKStatus = 'loading' | 'ready' | 'error' | 'config-missing';
type WSStatus = 'disconnected' | 'connecting' | 'connected';

export interface AvatarRuntimeDiagnostics {
  environment: 'browser' | 'mini-program-web-view';
  acceleration: 'prefer-hardware' | 'prefer-software' | 'auto';
  sdkScriptLoaded: boolean;
  sdkConstructorReady: boolean;
  containerReady: boolean;
  containerWidth: number;
  containerHeight: number;
  containerChildCount: number;
  webglSupported: boolean;
  webgl2Supported: boolean;
  videoDecoderSupported: boolean;
  audioContextState: string;
  sdkStatus: SDKStatus;
  wsStatus: WSStatus;
  lastSdkState: string;
  lastRenderState: string;
  lastVoiceState: string;
  lastSdkMessage: string;
  lastLogMessage: string;
  lastError: string;
  lastAudioUrl: string;
  lastAudioText: string;
  lastAudioAt: string;
  renderNodeSummary: string[];
}

const EMPTY_DIAGNOSTICS: AvatarRuntimeDiagnostics = {
  environment: 'browser',
  acceleration: 'prefer-hardware',
  sdkScriptLoaded: false,
  sdkConstructorReady: false,
  containerReady: false,
  containerWidth: 0,
  containerHeight: 0,
  containerChildCount: 0,
  webglSupported: false,
  webgl2Supported: false,
  videoDecoderSupported: false,
  audioContextState: 'unsupported',
  sdkStatus: 'loading',
  wsStatus: 'disconnected',
  lastSdkState: '',
  lastRenderState: '',
  lastVoiceState: '',
  lastSdkMessage: '',
  lastLogMessage: '',
  lastError: '',
  lastAudioUrl: '',
  lastAudioText: '',
  lastAudioAt: '',
  renderNodeSummary: [],
};

function stripThink(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function getSearchValue(name: string) {
  if (typeof window === 'undefined') {
    return '';
  }

  return new URLSearchParams(window.location.search).get(name)?.trim() || '';
}

function detectRendererRelayMode() {
  return getSearchValue('source') === 'renderer' || getSearchValue('relay') === '1';
}

function installWebglCapturePatch() {
  if (
    typeof window === 'undefined' ||
    typeof HTMLCanvasElement === 'undefined' ||
    !detectRendererRelayMode() ||
    (window as any).__KIN_AVATAR_WEBGL_CAPTURE_PATCHED__
  ) {
    return;
  }

  const prototype = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  const originalGetContext = prototype.getContext;

  prototype.getContext = function patchedGetContext(this: HTMLCanvasElement, contextId: unknown, options?: unknown) {
    if (typeof contextId === 'string' && /^webgl2?$|^experimental-webgl$/i.test(contextId)) {
      const patchedOptions =
        options && typeof options === 'object'
          ? { ...(options as WebGLContextAttributes), preserveDrawingBuffer: true }
          : { preserveDrawingBuffer: true };

      return originalGetContext.call(this, contextId, patchedOptions);
    }

    return originalGetContext.apply(this, [contextId, options]);
  };

  (window as any).__KIN_AVATAR_WEBGL_CAPTURE_PATCHED__ = true;
}

function detectMiniProgramEnvironment() {
  if (typeof window === 'undefined') {
    return false;
  }

  const wxEnvironment = (window as any).__wxjs_environment === 'miniprogram';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const userAgentHint = /miniProgram/i.test(userAgent);
  const bridgeHint = Boolean((window as any).wx?.miniProgram);
  return wxEnvironment || userAgentHint || bridgeHint;
}

function resolveAccelerationMode(): 'prefer-hardware' | 'prefer-software' | 'auto' {
  const requested = getSearchValue('acceleration').toLowerCase();
  if (requested === 'hardware') {
    return 'prefer-hardware';
  }
  if (requested === 'software') {
    return 'prefer-software';
  }
  if (requested === 'auto') {
    return 'auto';
  }

  return detectMiniProgramEnvironment() ? 'prefer-software' : 'prefer-hardware';
}

function detectGraphicsSupport() {
  if (typeof document === 'undefined') {
    return {
      webglSupported: false,
      webgl2Supported: false,
    };
  }

  try {
    const canvas = document.createElement('canvas');
    return {
      webglSupported: Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
      webgl2Supported: Boolean(canvas.getContext('webgl2')),
    };
  } catch (error) {
    return {
      webglSupported: false,
      webgl2Supported: false,
    };
  }
}

function getAudioContextState() {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }

  const audioContext = (window as any).audioContext;
  if (audioContext?.state) {
    return String(audioContext.state);
  }

  if (typeof (window as any).AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
    return 'available';
  }

  return 'unsupported';
}

function summarizeStageNodes(container: HTMLElement | null) {
  if (!container) {
    return [] as string[];
  }

  const summaries: string[] = [];
  const directChildren = Array.from(container.children).slice(0, 4);

  directChildren.forEach((node, index) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    summaries.push(
      `${index + 1}.${node.tagName.toLowerCase()} ${Math.round(rect.width)}x${Math.round(rect.height)} display=${style.display} visibility=${style.visibility} opacity=${style.opacity}`
    );

    const nestedMedia = Array.from(node.querySelectorAll('canvas,video,iframe')).slice(0, 2);
    nestedMedia.forEach((mediaNode, mediaIndex) => {
      if (!(mediaNode instanceof HTMLElement)) {
        return;
      }

      const mediaRect = mediaNode.getBoundingClientRect();
      const mediaStyle = window.getComputedStyle(mediaNode);
      summaries.push(
        `${index + 1}.${mediaIndex + 1}.${mediaNode.tagName.toLowerCase()} ${Math.round(mediaRect.width)}x${Math.round(mediaRect.height)} display=${mediaStyle.display} visibility=${mediaStyle.visibility} opacity=${mediaStyle.opacity}`
      );
    });
  });

  return summaries.slice(0, 8);
}

export const XmovAvatar: React.FC<XmovAvatarProps> = ({
  isActive: _isActive = false,
  websocketUrl = FAY_WS_URL,
  onSDKReady,
  onSDKError,
  onSpeaking,
  onSDKStatusChange,
  onWSStatusChange,
  onLogMessage,
  onIdleStateChange,
  onDiagnosticsChange,
  idleTimeout = 5 * 60 * 1000,
  resetIdleTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<XmovAvatarSDK | null>(null);
  const wsServiceRef = useRef<WebSocketService | null>(null);
  const sdkStatusRef = useRef<SDKStatus>('loading');
  const wsStatusRef = useRef<WSStatus>('disconnected');
  const diagnosticsRef = useRef<AvatarRuntimeDiagnostics>({
      ...EMPTY_DIAGNOSTICS,
    environment: detectMiniProgramEnvironment() ? 'mini-program-web-view' : 'browser',
    acceleration: resolveAccelerationMode(),
    sdkScriptLoaded: isXmovSDKLoaded(),
    sdkConstructorReady: typeof window !== 'undefined' && Boolean((window as any).XmovAvatar),
    videoDecoderSupported: typeof window !== 'undefined' && typeof (window as any).VideoDecoder !== 'undefined',
    audioContextState: getAudioContextState(),
    ...detectGraphicsSupport(),
  });
  const onSDKReadyRef = useRef(onSDKReady);
  const onSDKErrorRef = useRef(onSDKError);
  const onSpeakingRef = useRef(onSpeaking);
  const onSDKStatusChangeRef = useRef(onSDKStatusChange);
  const onWSStatusChangeRef = useRef(onWSStatusChange);
  const onIdleStateChangeRef = useRef(onIdleStateChange);
  const onLogMessageRef = useRef(onLogMessage);
  const onDiagnosticsChangeRef = useRef(onDiagnosticsChange);
  const initTimeoutRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const conversationTimeoutRef = useRef<number | null>(null);
  const snapshotTimerRef = useRef<number | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const isConversationActiveRef = useRef(false);
  const hasSpeakStartedRef = useRef(false);
  const isThinkingRef = useRef(false);
  const isIdleRef = useRef(false);
  const resetIdleTimerRef = useRef<(() => void) | null>(null);
  const [sdkStatus, setSDKStatus] = useState<SDKStatus>('loading');
  const [wsStatus, setWsStatus] = useState<WSStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);

  const publishDiagnostics = (partial?: Partial<AvatarRuntimeDiagnostics>) => {
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();

    diagnosticsRef.current = {
      ...diagnosticsRef.current,
      sdkStatus: sdkStatusRef.current,
      wsStatus: wsStatusRef.current,
      sdkScriptLoaded: isXmovSDKLoaded(),
      sdkConstructorReady: typeof window !== 'undefined' && Boolean((window as any).XmovAvatar),
      audioContextState: getAudioContextState(),
      containerReady: Boolean(rect && rect.width >= 180 && rect.height >= 280),
      containerWidth: rect ? Math.round(rect.width) : 0,
      containerHeight: rect ? Math.round(rect.height) : 0,
      containerChildCount: container?.children?.length || 0,
      renderNodeSummary: summarizeStageNodes(container || null),
      ...partial,
    };

    (window as any).__KIN_AVATAR_DIAGNOSTICS__ = diagnosticsRef.current;
    onDiagnosticsChangeRef.current?.(diagnosticsRef.current);
  };

  useEffect(() => {
    onSDKReadyRef.current = onSDKReady;
    onSDKErrorRef.current = onSDKError;
    onSpeakingRef.current = onSpeaking;
    onSDKStatusChangeRef.current = onSDKStatusChange;
    onWSStatusChangeRef.current = onWSStatusChange;
    onIdleStateChangeRef.current = onIdleStateChange;
    onLogMessageRef.current = onLogMessage;
    onDiagnosticsChangeRef.current = onDiagnosticsChange;
  });

  useEffect(() => {
    onSDKStatusChangeRef.current?.(sdkStatus);
    sdkStatusRef.current = sdkStatus;
    publishDiagnostics({ sdkStatus });
  }, [sdkStatus]);

  useEffect(() => {
    onWSStatusChangeRef.current?.(wsStatus);
    wsStatusRef.current = wsStatus;
    publishDiagnostics({ wsStatus });
  }, [wsStatus]);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const resetIdleTimer = () => {
    clearIdleTimer();

    if (isIdleRef.current) {
      isIdleRef.current = false;
      onIdleStateChangeRef.current?.(false);
    }

    idleTimerRef.current = window.setTimeout(() => {
      isIdleRef.current = true;
      onIdleStateChangeRef.current?.(true);
    }, idleTimeout);
  };

  const clearConversationTimeout = () => {
    if (conversationTimeoutRef.current) {
      window.clearTimeout(conversationTimeoutRef.current);
      conversationTimeoutRef.current = null;
    }
  };

  const ensureAudioContextRunning = async () => {
    try {
      if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') {
        publishDiagnostics({ audioContextState: 'unsupported' });
        return;
      }

      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = (window as any).audioContext || new AudioContextClass();

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      (window as any).audioContext = audioContext;
      publishDiagnostics({ audioContextState: audioContext.state || 'running' });
    } catch (error) {
      publishDiagnostics({
        audioContextState: 'error',
        lastError: error instanceof Error ? error.message : 'Failed to resume AudioContext',
      });
      console.error('[xmov] failed to resume AudioContext', error);
    }
  };

  const waitForContainerReady = async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && rect.width >= 180 && rect.height >= 280) {
        publishDiagnostics({
          containerReady: true,
          containerWidth: Math.round(rect.width),
          containerHeight: Math.round(rect.height),
        });
        return rect;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 100);
      });
    }

    throw new Error('Avatar container size is not ready yet.');
  };

  const ensureAvatarVisible = (
    sdk: XmovAvatarSDK,
    options?: {
      normalizeInvisible?: boolean;
      useInteractiveIdle?: boolean;
    }
  ) => {
    try {
      sdk.onlineMode();
    } catch (error) {
      console.warn('[xmov] onlineMode failed', error);
    }

    if (options?.normalizeInvisible) {
      try {
        sdk.switchInvisibleMode?.('normal');
      } catch (error) {
        console.warn('[xmov] switchInvisibleMode failed', error);
      }
    }

    try {
      sdk.changeAvatarVisible?.(true);
    } catch (error) {
      console.warn('[xmov] changeAvatarVisible failed', error);
    }

    try {
      sdk.setVolume?.(1);
    } catch (error) {
      console.warn('[xmov] setVolume failed', error);
    }

    if (options?.useInteractiveIdle) {
      window.setTimeout(() => {
        try {
          sdk.interactiveIdle();
        } catch (error) {
          console.warn('[xmov] interactiveIdle failed', error);
        }
      }, 160);
    }
  };

  const forceStageNodesVisible = () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.style.position = 'relative';
    container.style.overflow = 'hidden';

    Array.from(container.querySelectorAll('canvas,video')).forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      node.style.width = '100%';
      node.style.height = '100%';
      node.style.maxWidth = '100%';
      node.style.maxHeight = '100%';
      (node.style as CSSStyleDeclaration).objectFit = 'contain';
    });

    publishDiagnostics();
  };

  const speakDirect = async (text: string) => {
    const content = text.trim();
      if (!sdkRef.current || !content) {
      return;
    }

    await ensureAudioContextRunning();
    ensureAvatarVisible(sdkRef.current, { normalizeInvisible: true });
    forceStageNodesVisible();
    sdkRef.current.speak(content, true, true);
    publishDiagnostics({
      lastSdkMessage: `directSpeak:${content.slice(0, 80)}`,
    });
  };

  useEffect(() => {
    if (resetIdleTrigger !== undefined && resetIdleTimerRef.current) {
      resetIdleTimerRef.current();
    }
  }, [resetIdleTrigger]);

  useEffect(() => {
    let mounted = true;

    const handleWebSocketMessage = async (message: WebSocketMessage) => {
      const data = message.Data || ({} as WebSocketMessage['Data']);
      const key = data.Key;

      if (key === 'log') {
        const logText = (data.Value || '').trim();
        if (logText) {
          onLogMessageRef.current?.(logText);
          publishDiagnostics({
            lastLogMessage: logText.slice(0, 140),
          });
          if (/思考|thinking/i.test(logText) && sdkRef.current) {
            isThinkingRef.current = true;
            try {
              sdkRef.current.think();
            } catch (error) {
              console.warn('[xmov] think failed', error);
            }
          }
        }
        return;
      }

      if (!sdkRef.current) {
        return;
      }

      if (key === 'audio') {
        const audioText = stripThink(data.Text || '');
        const audioUrl = (data.HttpValue || '').trim();

        publishDiagnostics({
          lastAudioUrl: audioUrl,
          lastAudioText: audioText,
          lastAudioAt: audioUrl ? new Date().toISOString() : diagnosticsRef.current.lastAudioAt,
          lastSdkMessage: `${key}:${audioText || audioUrl}`.slice(0, 140),
        });

        return;
      }

      const rawText = data.Value || '';
      const cleanedText = stripThink(rawText);
      const isFirst = data.IsFirst === 1;
      const isEnd = data.IsEnd === 1;

      publishDiagnostics({
        lastSdkMessage: `${key}:${cleanedText || rawText}`.slice(0, 140),
      });
      resetIdleTimer();

      if (rawText.includes('</think>')) {
        isThinkingRef.current = false;
      }

      if (isFirst) {
        clearConversationTimeout();
        isConversationActiveRef.current = true;
        hasSpeakStartedRef.current = false;
      }

      if (isThinkingRef.current && !rawText.includes('</think>')) {
        if (isEnd && hasSpeakStartedRef.current) {
          sdkRef.current.speak(' ', false, true);
          isConversationActiveRef.current = false;
          hasSpeakStartedRef.current = false;
        }
        return;
      }

      if (cleanedText) {
        const shouldBeStart = !hasSpeakStartedRef.current;
        await ensureAudioContextRunning();
        ensureAvatarVisible(sdkRef.current, { normalizeInvisible: true });
        sdkRef.current.speak(cleanedText, shouldBeStart, isEnd);
        hasSpeakStartedRef.current = true;
      }

      if (isEnd) {
        clearConversationTimeout();
        isConversationActiveRef.current = false;
        hasSpeakStartedRef.current = false;
        return;
      }

      if (isConversationActiveRef.current && hasSpeakStartedRef.current) {
        clearConversationTimeout();
        conversationTimeoutRef.current = window.setTimeout(() => {
          if (sdkRef.current && hasSpeakStartedRef.current) {
            try {
              sdkRef.current.speak(' ', false, true);
            } catch (error) {
              console.warn('[xmov] forced conversation end failed', error);
            }
          }
          isConversationActiveRef.current = false;
          hasSpeakStartedRef.current = false;
          isThinkingRef.current = false;
        }, 30000);
      }
    };

    const connectWebSocket = () => {
      wsServiceRef.current?.disconnect();
      wsServiceRef.current = new WebSocketService({
        url: websocketUrl,
        onConnect: () => {
          setWsStatus('connected');
          resetIdleTimer();
        },
        onDisconnect: () => {
          setWsStatus('disconnected');
        },
        onError: () => {
          setWsStatus('disconnected');
        },
        onMessage: (message) => {
          void handleWebSocketMessage(message);
        },
      });

      setWsStatus('connecting');
      wsServiceRef.current.connect();
    };

    const initializeSDK = async () => {
      try {
        const config = getXmovConfig();
        if (!isXmovConfigValid(config)) {
          setSDKStatus('config-missing');
          setErrorMessage('XMOV_APP_ID and XMOV_APP_SECRET are required.');
          publishDiagnostics({
            lastError: 'Missing XMOV credentials',
          });
          return;
        }

        installWebglCapturePatch();
        await loadXmovSDK();
        publishDiagnostics({
          sdkScriptLoaded: true,
          sdkConstructorReady: typeof window !== 'undefined' && Boolean((window as any).XmovAvatar),
        });

        if (!mounted) {
          return;
        }

        const rect = await waitForContainerReady();
        const containerId = `xmov-container-${Date.now()}`;
        if (containerRef.current) {
          containerRef.current.id = containerId;
          containerRef.current.style.position = 'relative';
          containerRef.current.style.overflow = 'hidden';
          containerRef.current.style.width = `${Math.max(rect.width, 240)}px`;
          containerRef.current.style.height = `${Math.max(rect.height, 360)}px`;
        }

        initTimeoutRef.current = window.setTimeout(() => {
          setSDKStatus('error');
          setErrorMessage('XMOV initialization timed out.');
          publishDiagnostics({
            lastError: 'XMOV initialization timed out.',
          });
          onSDKErrorRef.current?.(new Error('SDK initialization timeout'));
        }, 30000);

        const sdk = new window.XmovAvatar({
          containerId: `#${containerId}`,
          appId: config.appId,
          appSecret: config.appSecret,
          gatewayServer: config.gatewayServer || 'https://nebula-agent.xingyun3d.com/user/v1/ttsa/session',
          hardwareAcceleration: diagnosticsRef.current.acceleration,
          onMessage: (payload: unknown) => {
            console.log('[xmov] sdk message', payload);
            publishDiagnostics({
              lastSdkMessage: typeof payload === 'string' ? payload.slice(0, 140) : JSON.stringify(payload).slice(0, 140),
            });
          },
          onStateChange: (state: string) => {
            publishDiagnostics({
              lastSdkState: state,
            });
          },
          onStatusChange: (status: string | number) => {
            const normalizedStatus = String(status);
            publishDiagnostics({
              lastSdkState: normalizedStatus,
            });
            if (normalizedStatus === 'invisible' || normalizedStatus === '5') {
              ensureAvatarVisible(sdk, {
                normalizeInvisible: true,
              });
            }
          },
          onStateRenderChange: (state: string, duration: number) => {
            publishDiagnostics({
              lastRenderState: `${state}:${duration}`,
            });
          },
          onVoiceStateChange: (status: string) => {
            const normalizedVoiceState = String(status);
            onSpeakingRef.current?.(normalizedVoiceState === 'start' || normalizedVoiceState === 'voice_start');
            publishDiagnostics({
              lastVoiceState: normalizedVoiceState,
            });
          },
          onStartSessionWarning: (code: number, message: string) => {
            publishDiagnostics({
              lastError: `XMOV session warning ${code}: ${message}`,
            });
          },
          enableLogger: false,
        });

        sdkRef.current = sdk;

        await sdk.init({
          initModel: 'normal',
          onDownloadProgress: (progress: number) => {
            setLoadingProgress(progress);
          },
          onError: (error: unknown) => {
            setSDKStatus('error');
            setErrorMessage('XMOV initialization failed.');
            publishDiagnostics({
              lastError: error instanceof Error ? error.message : 'XMOV initialization failed.',
            });
            onSDKErrorRef.current?.(error);
          },
        });

        if (!mounted) {
          return;
        }

        if (initTimeoutRef.current) {
          window.clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }

        setSDKStatus('ready');
        ensureAvatarVisible(sdk, {
          normalizeInvisible: true,
        });
        forceStageNodesVisible();
        window.setTimeout(forceStageNodesVisible, 300);
        window.setTimeout(forceStageNodesVisible, 1200);
        window.setTimeout(forceStageNodesVisible, 2400);
        onSDKReadyRef.current?.();

        (window as any).xmovSDK = sdk;
        (window as any).prepareXmovAudio = async () => {
          await ensureAudioContextRunning();
          if (sdkRef.current) {
            ensureAvatarVisible(sdkRef.current, { normalizeInvisible: true });
            forceStageNodesVisible();
          }
        };
        (window as any).testXmovSpeak = (text = 'Hello from XMOV') => speakDirect(text);

        connectWebSocket();
      } catch (error) {
        if (initTimeoutRef.current) {
          window.clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }

        if (mounted) {
          setSDKStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Unknown XMOV error');
          publishDiagnostics({
            lastError: error instanceof Error ? error.message : 'Unknown XMOV error',
          });
          onSDKErrorRef.current?.(error);
        }
      }
    };

    resetIdleTimerRef.current = resetIdleTimer;
    resetIdleTimer();
    publishDiagnostics();

    if (typeof MutationObserver !== 'undefined' && containerRef.current) {
      mutationObserverRef.current = new MutationObserver(() => {
        forceStageNodesVisible();
      });
      mutationObserverRef.current.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }

    snapshotTimerRef.current = window.setInterval(() => {
      forceStageNodesVisible();
      publishDiagnostics();
    }, 1500);

    void initializeSDK();

    return () => {
      mounted = false;

      if (snapshotTimerRef.current) {
        window.clearInterval(snapshotTimerRef.current);
        snapshotTimerRef.current = null;
      }

      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }

      if (initTimeoutRef.current) {
        window.clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }

      clearIdleTimer();
      clearConversationTimeout();
      wsServiceRef.current?.disconnect();
      wsServiceRef.current = null;

      if (sdkRef.current) {
        try {
          sdkRef.current.destroy();
        } catch (error) {
          console.warn('[xmov] destroy failed', error);
        }
        sdkRef.current = null;
      }
    };
  }, [websocketUrl, idleTimeout]);

  return (
    <div className="relative h-full w-full bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100">
      <div ref={containerRef} className="absolute inset-0 block h-full w-full" style={{ zIndex: 1 }} />

      {sdkStatus !== 'ready' ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100">
          <div className="px-8 text-center">
            {sdkStatus === 'loading' ? (
              <>
                <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <p className="mb-2 text-xl font-medium text-gray-700">Initializing...</p>
                {loadingProgress > 0 ? <p className="text-base text-gray-500">Loading assets {loadingProgress}%</p> : null}
              </>
            ) : null}
            {sdkStatus === 'config-missing' ? (
              <>
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center text-6xl">!</div>
                <p className="mb-2 text-xl font-medium text-red-600">XMOV credentials missing</p>
                <p className="text-base text-gray-600">{errorMessage}</p>
              </>
            ) : null}
            {sdkStatus === 'error' ? (
              <>
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center text-6xl">x</div>
                <p className="mb-2 text-xl font-medium text-red-600">XMOV failed to start</p>
                <p className="text-base text-gray-600">{errorMessage}</p>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
