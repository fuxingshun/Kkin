/**
 * XmovAvatar SDK TypeScript Type Definitions
 */

export interface XmovConfig {
  appId: string;
  appSecret: string;
  gatewayServer?: string;
}

export interface XmovSDKOptions {
  containerId: string;
  appId: string;
  appSecret: string;
  gatewayServer: string;
  hardwareAcceleration?: 'prefer-hardware' | 'prefer-software' | 'auto';
  onWidgetEvent?: (data: any) => void;
  onNetworkInfo?: (networkInfo: any) => void;
  onMessage?: (message: any) => void;
  onStateChange?: (state: string) => void;
  onStatusChange?: (status: string | number) => void;
  onStateRenderChange?: (state: string, duration: number) => void;
  onVoiceStateChange?: (status: 'start' | 'end' | 'voice_start' | 'voice_end' | string) => void;
  onStartSessionWarning?: (code: number, message: string) => void;
  enableLogger?: boolean;
}

export interface XmovInitOptions {
  initModel?: 'normal' | 'invisible';
  onDownloadProgress?: (progress: number) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
}

export interface XmovAvatarSDK {
  init(options: XmovInitOptions): Promise<void>;
  speak(text: string, isFirst: boolean, isEnd: boolean): void;
  think(): void;
  interactiveIdle(): void;
  offlineMode(): void;
  onlineMode(): void;
  setVolume?(volume: number): void;
  showDebugInfo?(): void;
  changeAvatarVisible?(visible: boolean): void;
  switchInvisibleMode?(mode?: 'normal' | 'invisible'): void;
  destroy(): void;
}

declare global {
  interface Window {
    XmovAvatar: new (options: XmovSDKOptions) => XmovAvatarSDK;
  }
}

export {};
