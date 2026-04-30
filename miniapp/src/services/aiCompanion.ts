import { DEFAULT_CHAT_USERNAME } from '@/config/runtime';
import { getActiveApiOrigin, request, uploadFile } from '@/utils/request';

const AI_CHAT_TIMEOUT = 18000;
const AI_SPEAK_TIMEOUT = 12000;
const AI_VOICE_CHAT_TIMEOUT = 120000;

export interface AiSpeakResult {
  success?: boolean;
  audioUrl: string;
  audioError: string;
  ttsProvider?: string;
}

interface AiActionResponse {
  success?: boolean;
  audio_url?: string;
  audio_error?: string;
  tts_provider?: string;
}

export interface AiChatResult extends AiSpeakResult {
  reply: string;
}

interface AiChatResponse extends AiActionResponse {
  reply?: string;
  chat_provider?: string;
  provider_error?: string;
}

interface AiVoiceChatResponse extends AiChatResponse {
  transcript?: string;
  asr_provider?: string;
  asr_error?: string;
}

export interface AiVoiceChatResult extends AiChatResult {
  transcript: string;
  asrProvider?: string;
  asrError?: string;
}

function toAbsoluteUrl(url: string | undefined) {
  const value = (url || '').trim();
  if (!value) {
    return '';
  }

  if (/^https?:\/\//.test(value)) {
    return value;
  }

  return `${getActiveApiOrigin()}${value.startsWith('/') ? '' : '/'}${value}`;
}

function normalizeSpeakResult(data: AiActionResponse): AiSpeakResult {
  return {
    success: data.success,
    audioUrl: toAbsoluteUrl(data.audio_url),
    audioError: data.audio_error || '',
    ttsProvider: data.tts_provider,
  };
}

export async function speakWithAi(text: string, user = DEFAULT_CHAT_USERNAME): Promise<AiSpeakResult> {
  const data = await request<AiActionResponse>('/elderly/ai/speak', {
    method: 'POST',
    data: {
      user,
      text,
    },
    timeout: AI_SPEAK_TIMEOUT,
  });

  return normalizeSpeakResult(data);
}

export async function chatWithAi(message: string, user = DEFAULT_CHAT_USERNAME): Promise<AiChatResult> {
  const data = await request<AiChatResponse>('/elderly/ai/chat', {
    method: 'POST',
    data: {
      user,
      message,
    },
    timeout: AI_CHAT_TIMEOUT,
  });

  const speakResult = normalizeSpeakResult(data);

  return {
    ...speakResult,
    reply: data.reply || '',
  };
}

export async function voiceChatWithAi(filePath: string, user = DEFAULT_CHAT_USERNAME): Promise<AiVoiceChatResult> {
  const data = await uploadFile<AiVoiceChatResponse>('/elderly/ai/voice-chat', {
    filePath,
    name: 'file',
    formData: {
      user,
    },
    timeout: AI_VOICE_CHAT_TIMEOUT,
  });

  const speakResult = normalizeSpeakResult(data);

  return {
    ...speakResult,
    transcript: data.transcript || '',
    reply: data.reply || '',
    asrProvider: data.asr_provider,
    asrError: data.asr_error,
  };
}
