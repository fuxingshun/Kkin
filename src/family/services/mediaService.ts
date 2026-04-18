/**
 * 家属端媒体服务
 * 负责与后端API交互，管理媒体文件的上传、查询、更新和删除
 */

import { API_BASE_URL, API_ORIGIN } from '../../config/runtime';

export interface Media {
  id: number;
  family_id: string;
  media_type: 'photo' | 'video';
  title: string;
  description?: string;
  file_path: string;
  file_size?: number;
  duration?: number;
  thumbnail_path?: string;
  uploaded_by?: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  tags: string[];
  time_windows: string[];
  moods: string[];
  occasions: string[];
  cooldown: number;
  priority: number;
  play_count: number;
  last_played_at?: string;
}

export interface MediaStatistics {
  total_plays: number;
  likes: number;
  dislikes: number;
}

export interface MediaDetail extends Media {
  statistics: MediaStatistics;
}

export interface RecentPlay {
  id: number;
  title: string;
  media_type: 'photo' | 'video';
  thumbnail_path: string | null;
  played_at: string;
  likes: number;
  dislikes: number;
}

export interface UploadMediaParams {
  file: File;
  family_id: string;
  title: string;
  description?: string;
  uploaded_by?: number;
}

export interface UpdateMediaParams {
  title?: string;
  description?: string;
  tags?: string[];
  time_windows?: string[];
  moods?: string[];
  occasions?: string[];
  cooldown?: number;
  priority?: number;
}

/**
 * 上传媒体文件
 */
export async function uploadMedia(params: UploadMediaParams): Promise<{ media_id: number; file_path: string; media_type: string }> {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('family_id', params.family_id);
  formData.append('title', params.title);
  if (params.description) {
    formData.append('description', params.description);
  }
  if (params.uploaded_by) {
    formData.append('uploaded_by', params.uploaded_by.toString());
  }

  const response = await fetch(`${API_BASE_URL}/family/media`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '上传失败');
  }

  return response.json();
}

/**
 * 获取家庭所有媒体列表
 */
export async function getFamilyMedia(familyId: string): Promise<Media[]> {
  const response = await fetch(`${API_BASE_URL}/family/media?family_id=${familyId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '获取媒体列表失败');
  }

  const data = await response.json();
  return data.media;
}

/**
 * 获取媒体详情
 */
export async function getMediaDetail(mediaId: number): Promise<MediaDetail> {
  const response = await fetch(`${API_BASE_URL}/family/media/${mediaId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '获取媒体详情失败');
  }

  return response.json();
}

/**
 * 更新媒体信息和策略
 */
export async function updateMedia(mediaId: number, params: UpdateMediaParams): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/family/media/${mediaId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '更新媒体失败');
  }
}

/**
 * 删除媒体
 */
export async function deleteMedia(mediaId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/family/media/${mediaId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '删除媒体失败');
  }
}

/**
 * 获取最近播放的媒体
 */
export async function getRecentPlays(familyId: string, limit: number = 10): Promise<RecentPlay[]> {
  const response = await fetch(`${API_BASE_URL}/family/media/recent-plays?family_id=${familyId}&limit=${limit}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '获取最近播放失败');
  }

  const data = await response.json();
  return data.recent_plays;
}

/**
 * 获取文件URL（用于前端显示）
 */
export function getMediaUrl(filePath: string): string {
  // 将服务器文件路径转换为可访问的URL
  // 这里需要根据实际的静态文件服务配置调整
  return `${API_ORIGIN}/uploads/${filePath.split(/[/\\]/).pop()}`;
}

/**
 * 获取缩略图URL
 */
export function getThumbnailUrl(thumbnailPath: string): string {
  return `${API_ORIGIN}/uploads/thumbnails/${thumbnailPath.split(/[/\\]/).pop()}`;
}
