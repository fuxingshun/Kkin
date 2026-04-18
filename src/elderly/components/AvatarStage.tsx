import React, { useState } from 'react';
import { XmovAvatar } from './XmovAvatar';
import type { AvatarRuntimeDiagnostics } from './XmovAvatar';
import { FAY_WS_URL } from '../../config/runtime';

interface AvatarStageProps {
  isActive?: boolean;
  websocketUrl?: string;
  onSDKStatusChange?: (status: 'loading' | 'ready' | 'error' | 'config-missing') => void;
  onWSStatusChange?: (status: 'disconnected' | 'connecting' | 'connected') => void;
  onLogMessage?: (message: string) => void;
  onIdleStateChange?: (isIdle: boolean) => void;
  onDiagnosticsChange?: (diagnostics: AvatarRuntimeDiagnostics) => void;
  idleTimeout?: number;
  resetIdleTrigger?: number;
}

export type { AvatarRuntimeDiagnostics } from './XmovAvatar';

/**
 * 数字人画面组件 - 承载 xmovsdk 渲染流
 * 占据主要屏幕空间，支持 9:16 竖屏
 * 连接到 WebSocket (10002端口) 接收消息驱动数字人说话
 */
export const AvatarStage: React.FC<AvatarStageProps> = ({
  isActive = false,
  websocketUrl = FAY_WS_URL,
  onSDKStatusChange,
  onWSStatusChange,
  onLogMessage,
  onIdleStateChange,
  onDiagnosticsChange,
  idleTimeout,
  resetIdleTrigger,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSDKReady = () => {
    console.log('[AvatarStage] 数字人SDK就绪');
  };

  const handleSDKError = (error: any) => {
    console.error('[AvatarStage] 数字人SDK错误:', error);
  };

  const handleSpeaking = (speaking: boolean) => {
    setIsSpeaking(speaking);
  };

  return (
    <div className="relative h-full w-full overflow-hidden" data-avatar-renderer-root="true">
      <XmovAvatar
        isActive={isActive || isSpeaking}
        websocketUrl={websocketUrl}
        onSDKReady={handleSDKReady}
        onSDKError={handleSDKError}
        onSpeaking={handleSpeaking}
        onSDKStatusChange={onSDKStatusChange}
        onWSStatusChange={onWSStatusChange}
        onLogMessage={onLogMessage}
        onIdleStateChange={onIdleStateChange}
        onDiagnosticsChange={onDiagnosticsChange}
        idleTimeout={idleTimeout}
        resetIdleTrigger={resetIdleTrigger}
      />
    </div>
  );
};
