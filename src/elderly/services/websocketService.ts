/**
 * WebSocket service for connecting to dialog engine (port 10002)
 */

export interface WebSocketMessage {
  Topic?: string;
  Data: {
    Key: 'text' | 'audio' | 'question' | 'log';
    Value?: string;
    HttpValue?: string;
    Text?: string;
    Time?: number;
    Type?: string;
    IsFirst?: number;
    IsEnd?: number;
    CONV_ID?: string;
    CONV_MSG_NO?: number;
    Lips?: Array<unknown>;
  };
  Username?: string;
  robot?: string;
}

export interface WebSocketServiceOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  maxReconnectAttempts?: number;
}

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectTimer: number | null = null;
  private isConnecting = false;
  private onMessageCallback?: (message: WebSocketMessage) => void;
  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;
  private onErrorCallback?: (error: Event) => void;

  constructor(options: WebSocketServiceOptions) {
    this.url = options.url;
    this.onMessageCallback = options.onMessage;
    this.onConnectCallback = options.onConnect;
    this.onDisconnectCallback = options.onDisconnect;
    this.onErrorCallback = options.onError;
    this.maxReconnectAttempts = options.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS;
  }

  connect(): void {
    if (this.isConnecting) {
      console.log('[Fay] 已有连接正在进行中，跳过');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Fay] 达到最大重连次数限制');
      return;
    }

    this.isConnecting = true;
    console.log('[Fay] 正在连接到', this.url);

    try {
      this.cleanup(false);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[Fay] 已连接到数字人接口');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // 发送初始化消息
        const initMsg = { Username: 'User', Output: true };
        console.log('[Fay] 发送初始化消息:', initMsg);
        this.send(initMsg);

        this.onConnectCallback?.();
      };

      this.ws.onmessage = (event) => {
        console.log('='.repeat(60));
        console.log('[Fay] 收到消息:', event.data);

        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[Fay] 解析后:', JSON.stringify(message, null, 2));

          if (!message || !message.Data || !message.Data.Key) {
            console.warn('[Fay] 消息格式不完整:', message);
            return;
          }

          // 处理文本消息
          if (message.Data.Key === 'text') {
            const text = message.Data.Value || '';
            const isFirst = message.Data.IsFirst === 1;
            const isEnd = message.Data.IsEnd === 1;

            if (text && text.trim()) {
              console.log('[xmov] 收到文本消息:', text, { is_start: isFirst, is_end: isEnd });
              this.onMessageCallback?.(message);
            } else {
              console.warn('[Fay] 收到空文本消息');
            }
          }
          // 处理音频消息
          else if (message.Data.Key === 'audio') {
            const text = message.Data.Text || '';
            const isFirst = message.Data.IsFirst === 1;
            const isEnd = message.Data.IsEnd === 1;

            if (text && text.trim()) {
              console.log('[xmov] 收到音频消息:', text, { is_start: isFirst, is_end: isEnd });
              this.onMessageCallback?.(message);
            } else {
              console.warn('[Fay] 收到空音频文本');
            }
          }
          // 处理日志消息（思考中等状态提示）
          else if (message.Data.Key === 'log') {
            const logText = message.Data.Value || '';
            console.log('[Fay] 收到日志消息:', logText);
            this.onMessageCallback?.(message);
          }
          // 处理问题消息
          else if (message.Data.Key === 'question') {
            console.log('[Fay] 用户问题:', message.Data.Value);
          } else {
            console.log('[Fay] 未知消息类型:', message.Data.Key);
          }
        } catch (error) {
          console.error('[Fay] 处理消息出错:', error, '原始数据:', event.data);
        }
        console.log('='.repeat(60));
      };

      this.ws.onerror = (error) => {
        console.error('[Fay] WebSocket错误:', error);
        this.isConnecting = false;
        this.onErrorCallback?.(error);
      };

      this.ws.onclose = (event) => {
        console.log('[Fay] WebSocket连接已关闭, 代码:', event.code, '原因:', event.reason);
        this.isConnecting = false;
        this.onDisconnectCallback?.();

        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // 使用指数退避策略重连
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.calculateReconnectDelay();
          console.log(`[Fay] ${delay}ms后尝试第${this.reconnectAttempts}次重连...`);

          this.reconnectTimer = window.setTimeout(() => {
            this.connect();
          }, delay);
        } else {
          console.error('[Fay] 已达到最大重连次数');
        }
      };
    } catch (error) {
      console.error('[Fay] 创建WebSocket连接失败:', error);
      this.isConnecting = false;
    }
  }

  send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch (error) {
        console.error('[Fay] 发送消息失败:', error);
      }
    }
  }

  disconnect(): void {
    this.cleanup(true);
  }

  private cleanup(resetReconnectAttempts: boolean): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;
        this.ws.close();
      } catch (error) {
        console.warn('[Fay] 清理WebSocket时出错:', error);
      }
      this.ws = null;
    }

    this.isConnecting = false;
    if (resetReconnectAttempts) {
      this.reconnectAttempts = 0;
    }
  }

  private calculateReconnectDelay(): number {
    const exponentialDelay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );
    const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(exponentialDelay + jitter);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
