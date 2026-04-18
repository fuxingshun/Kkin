import { DEFAULT_CHAT_USERNAME } from '@/config/runtime';
import { buildQueryString, request } from '@/utils/request';

export interface InteractionMessage {
  username: string;
  is_adopted: number;
  type: 'fay' | 'member';
  way: string;
  content: string;
  createtime: number;
  timetext?: string;
}

interface InteractionResponse {
  list?: InteractionMessage[];
  available?: boolean;
  error?: string;
  username?: string;
  limit?: number;
}

export interface InteractionHistoryResult {
  list: InteractionMessage[];
  available: boolean;
  error: string;
  username: string;
  limit: number;
}

export async function getInteractionHistory(
  username = DEFAULT_CHAT_USERNAME,
  limit = 100
): Promise<InteractionHistoryResult> {
  const query = buildQueryString({
    username,
    limit: String(limit),
  });

  const data = await request<InteractionResponse>(`/family/interactions?${query}`);
  const list = (data.list || [])
    .slice()
    .sort((a, b) => toInteractionTimestampMs(b.createtime) - toInteractionTimestampMs(a.createtime));

  return {
    list,
    available: data.available !== false,
    error: data.error || '',
    username: data.username || username,
    limit: data.limit || limit,
  };
}

export async function getInteractionMessages(username = DEFAULT_CHAT_USERNAME, limit = 100) {
  const data = await getInteractionHistory(username, limit);
  return data.list;
}

export function sanitizeInteractionContent(content: string) {
  const stripped = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<prestart[\s\S]*?<\/prestart>/gi, '')
    .replace(/<prestart[\s\S]*$/gi, '')
    .trim();

  if (!stripped) {
    return '';
  }

  if (
    stripped.includes('vector store empty') ||
    stripped.includes('run ingest_yueshen first') ||
    stripped.includes('chromadb_yueshen') ||
    stripped.includes('default_corpus_dir')
  ) {
    return '';
  }

  return stripped;
}

export function formatInteractionTime(timestamp: number) {
  const date = toInteractionDate(timestamp);
  const now = new Date();
  const timeText = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (date.toDateString() === now.toDateString()) {
    return timeText;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${timeText}`;
  }

  return `${date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  })} ${timeText}`;
}

export function toInteractionTimestampMs(timestamp: number) {
  const raw = Number(timestamp) || 0;
  return raw > 9999999999 ? raw : raw * 1000;
}

export function toInteractionDate(timestamp: number) {
  return new Date(toInteractionTimestampMs(timestamp));
}

export function getInteractionDateKey(timestamp: number) {
  const date = toInteractionDate(timestamp);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return '今天';
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天';
  }

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

export function groupMessagesByDate(messages: InteractionMessage[]) {
  return messages.reduce<Record<string, InteractionMessage[]>>((groups, item) => {
    const dateKey = getInteractionDateKey(item.createtime);

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push(item);
    return groups;
  }, {});
}

export function countTodayMemberMessages(messages: InteractionMessage[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  return messages.filter(
    (item) => item.type === 'member' && toInteractionTimestampMs(item.createtime) >= todayTimestamp
  ).length;
}
