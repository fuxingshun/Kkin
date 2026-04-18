import { API_ORIGIN, DEFAULT_CHAT_USERNAME } from '@/config/runtime';
import { request, uploadFile } from '@/utils/request';

export interface AvatarRelayStatus {
  rendererOnline: boolean;
  rendererAgeMs: number | null;
  frameAvailable: boolean;
  frameAgeMs: number | null;
  imageUrl: string;
  frameUpdatedAt: string;
  frameVersion: number;
  frameWidth: number;
  frameHeight: number;
  frameText: string;
  frameSpeaking: boolean;
  sdkStatus: string;
  wsStatus: string;
  environment: string;
  acceleration: string;
  renderNodes: number;
  audioState: string;
  lastVoiceState: string;
  lastNotice: string;
  lastError: string;
  lastCommandId: number;
  lastCommandType: string;
  lastCommandText: string;
  lastAudioUrl: string;
  lastAudioText: string;
  lastAudioAt: string;
}

interface AvatarRelayStatusResponse {
  renderer_online?: boolean;
  renderer_age_ms?: number | null;
  frame_available?: boolean;
  frame_age_ms?: number | null;
  image_url?: string;
  frame_updated_at?: string;
  frame_version?: number;
  frame_width?: number;
  frame_height?: number;
  frame_text?: string;
  frame_speaking?: boolean;
  sdk_status?: string;
  ws_status?: string;
  environment?: string;
  acceleration?: string;
  render_nodes?: number;
  audio_state?: string;
  last_voice_state?: string;
  last_notice?: string;
  last_error?: string;
  last_command_id?: number;
  last_command_type?: string;
  last_command_text?: string;
  last_audio_url?: string;
  last_audio_text?: string;
  last_audio_at?: string;
}

export interface AvatarSpeakResult {
  success?: boolean;
  audioUrl: string;
  audioError: string;
  rendererCommandId: number | null;
}

interface AvatarActionResponse {
  success?: boolean;
  audio_url?: string;
  audio_error?: string;
  renderer_command_id?: number | null;
  result?: {
    enabled?: boolean;
    message?: string;
  };
}

export interface AvatarChatResult extends AvatarSpeakResult {
  reply: string;
  noReply: boolean;
}

interface AvatarChatResponse extends AvatarActionResponse {
  reply?: string;
  no_reply?: boolean;
}

interface AvatarVoiceChatResponse extends AvatarChatResponse {
  transcript?: string;
}

export interface AvatarVoiceChatResult extends AvatarChatResult {
  transcript: string;
}

function toAbsoluteUrl(url: string | undefined) {
  const value = (url || '').trim();
  if (!value) {
    return '';
  }

  if (/^https?:\/\//.test(value)) {
    return value;
  }

  return `${API_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`;
}

function normalizeSpeakResult(data: AvatarActionResponse): AvatarSpeakResult {
  return {
    success: data.success,
    audioUrl: toAbsoluteUrl(data.audio_url),
    audioError: data.audio_error || '',
    rendererCommandId: data.renderer_command_id ?? null,
  };
}

export async function getAvatarRelayStatus(): Promise<AvatarRelayStatus> {
  const data = await request<AvatarRelayStatusResponse>('/elderly/avatar/renderer/status');

  return {
    rendererOnline: data.renderer_online === true,
    rendererAgeMs: data.renderer_age_ms ?? null,
    frameAvailable: data.frame_available === true,
    frameAgeMs: data.frame_age_ms ?? null,
    imageUrl: toAbsoluteUrl(data.image_url),
    frameUpdatedAt: data.frame_updated_at || '',
    frameVersion: data.frame_version || 0,
    frameWidth: data.frame_width || 0,
    frameHeight: data.frame_height || 0,
    frameText: data.frame_text || '',
    frameSpeaking: data.frame_speaking === true,
    sdkStatus: data.sdk_status || '',
    wsStatus: data.ws_status || '',
    environment: data.environment || '',
    acceleration: data.acceleration || '',
    renderNodes: data.render_nodes || 0,
    audioState: data.audio_state || '',
    lastVoiceState: data.last_voice_state || '',
    lastNotice: data.last_notice || '',
    lastError: data.last_error || '',
    lastCommandId: data.last_command_id || 0,
    lastCommandType: data.last_command_type || '',
    lastCommandText: data.last_command_text || '',
    lastAudioUrl: toAbsoluteUrl(data.last_audio_url),
    lastAudioText: data.last_audio_text || '',
    lastAudioAt: data.last_audio_at || '',
  };
}

export async function speakWithAvatar(text: string, user = DEFAULT_CHAT_USERNAME): Promise<AvatarSpeakResult> {
  const data = await request<AvatarActionResponse>('/elderly/avatar/speak', {
    method: 'POST',
    data: {
      user,
      text,
    },
  });

  return normalizeSpeakResult(data);
}

export async function chatWithAvatar(message: string, user = DEFAULT_CHAT_USERNAME): Promise<AvatarChatResult> {
  const data = await request<AvatarChatResponse>('/elderly/avatar/chat', {
    method: 'POST',
    data: {
      user,
      message,
    },
  });

  const speakResult = normalizeSpeakResult(data);

  return {
    ...speakResult,
    reply: data.reply || '',
    noReply: data.no_reply === true,
  };
}

export async function voiceChatWithAvatar(filePath: string, user = DEFAULT_CHAT_USERNAME): Promise<AvatarVoiceChatResult> {
  const data = await uploadFile<AvatarVoiceChatResponse>('/elderly/avatar/voice-chat', {
    filePath,
    name: 'file',
    formData: {
      user,
    },
  });

  const speakResult = normalizeSpeakResult(data);

  return {
    ...speakResult,
    transcript: data.transcript || '',
    reply: data.reply || '',
    noReply: data.no_reply === true,
  };
}

export async function toggleAvatarMicrophone(enabled: boolean) {
  const data = await request<AvatarActionResponse>('/elderly/avatar/microphone', {
    method: 'POST',
    data: {
      enabled,
    },
  });

  return data.result?.enabled ?? enabled;
}
