/**
 * 老人端媒体服务
 * 负责获取推荐媒体、记录播放、提交反馈
 */

import { API_BASE_URL, API_ORIGIN } from '../../config/runtime';

export interface RecommendedMedia {
  id: number;
  family_id: string;
  media_type: 'photo' | 'video';
  title: string;
  description?: string;
  file_path: string;
  thumbnail_path?: string;
  tags: string[];
  time_windows: string[];
  moods: string[];
  occasions: string[];
  cooldown: number;
  priority: number;
  play_count: number;
  last_played_at?: string;
}

export interface PlayRecordParams {
  elderly_id: number;
  duration_watched?: number;
  completed?: number;
  triggered_by?: 'auto' | 'manual' | 'mood';
  mood_before?: string;
  mood_after?: string;
}

export interface FeedbackParams {
  elderly_id: number;
  feedback_type: 'like' | 'dislike';
}

export interface RecommendedMediaResponse {
  media: RecommendedMedia[];
  available_tags: string[];
}

/**
 * 获取推荐媒体
 */
export async function getRecommendedMedia(
  familyId: string,
  elderlyId: number,
  mood?: string,
  occasion?: string,
  tags?: string[]
): Promise<RecommendedMediaResponse> {
  const params = new URLSearchParams({
    family_id: familyId,
    elderly_id: elderlyId.toString(),
  });

  if (mood) params.append('mood', mood);
  if (occasion) params.append('occasion', occasion);
  if (tags && tags.length > 0) params.append('tags', tags.join(','));

  const response = await fetch(`${API_BASE_URL}/elderly/media/recommended?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '获取推荐媒体失败');
  }

  const data = await response.json();
  return {
    media: data.media,
    available_tags: data.available_tags || []
  };
}

/**
 * 记录媒体播放
 */
export async function recordMediaPlay(mediaId: number, params: PlayRecordParams): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/elderly/media/${mediaId}/play`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '记录播放失败');
  }
}

/**
 * 提交媒体反馈
 */
export async function submitFeedback(mediaId: number, params: FeedbackParams): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/elderly/media/${mediaId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '提交反馈失败');
  }
}

/**
 * 获取文件URL（用于前端显示）
 */
export function getMediaUrl(filePath: string): string {
  // 将服务器文件路径转换为可访问的URL
  return `${API_ORIGIN}/uploads/${filePath.split(/[/\\]/).pop()}`;
}

/**
 * 获取缩略图URL
 */
export function getThumbnailUrl(thumbnailPath: string): string {
  return `${API_ORIGIN}/uploads/thumbnails/${thumbnailPath.split(/[/\\]/).pop()}`;
}
