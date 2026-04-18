/**
 * 老人端 - 日程管理服务
 * 侧重于日程查看和提醒功能
 */

import { API_BASE_URL } from '../../config/runtime';

export interface Schedule {
  id?: number;
  family_id: string;
  title: string;
  description?: string;
  schedule_type?: 'medication' | 'exercise' | 'meal' | 'checkup' | 'other';
  schedule_time: string;
  repeat_type?: 'once' | 'daily' | 'weekly' | 'monthly';
  repeat_days?: string;
  status?: 'pending' | 'completed' | 'skipped' | 'missed';
  completed_at?: string;
  auto_remind?: number;
  is_active?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Reminder {
  id: number;
  schedule_id: number;
  elderly_id: number;
  remind_time: string;
  status: 'pending' | 'completed' | 'missed' | 'dismissed';
  completed_at?: string;
  created_at?: string;
}

export interface ScheduleResponse {
  schedules: Schedule[];
}

export interface ActionResponse {
  success: boolean;
}

/**
 * 获取今日日程
 */
export async function getTodaySchedules(familyId: string): Promise<Schedule[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/elderly/schedules/today?family_id=${familyId}`
    );

    if (!response.ok) {
      throw new Error(`获取今日日程失败: ${response.statusText}`);
    }

    const data: ScheduleResponse = await response.json();
    return data.schedules || [];
  } catch (error) {
    console.error('获取今日日程错误:', error);
    throw error;
  }
}

/**
 * 获取即将到来的日程（下一小时内）
 */
export async function getUpcomingSchedules(
  familyId: string,
  elderlyId?: string
): Promise<Schedule[]> {
  try {
    const url = new URL(`${API_BASE_URL}/elderly/schedules/upcoming`);
    url.searchParams.append('family_id', familyId);
    if (elderlyId) {
      url.searchParams.append('elderly_id', elderlyId);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`获取即将到来的日程失败: ${response.statusText}`);
    }

    const data: ScheduleResponse = await response.json();
    return data.schedules || [];
  } catch (error) {
    console.error('获取即将到来的日程错误:', error);
    throw error;
  }
}

/**
 * 标记提醒为已完成
 */
export async function completeReminder(reminderId: number): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/elderly/reminders/${reminderId}/complete`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error(`标记提醒完成失败: ${response.statusText}`);
    }

    const data: ActionResponse = await response.json();
    return data.success;
  } catch (error) {
    console.error('标记提醒完成错误:', error);
    throw error;
  }
}

/**
 * 忽略提醒
 */
export async function dismissReminder(reminderId: number): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/elderly/reminders/${reminderId}/dismiss`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error(`忽略提醒失败: ${response.statusText}`);
    }

    const data: ActionResponse = await response.json();
    return data.success;
  } catch (error) {
    console.error('忽略提醒错误:', error);
    throw error;
  }
}

/**
 * 更新日程状态
 */
export async function updateScheduleStatus(
  scheduleId: number,
  status: 'pending' | 'completed' | 'skipped' | 'missed'
): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/elderly/schedules/${scheduleId}/status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      }
    );

    if (!response.ok) {
      throw new Error(`更新日程状态失败: ${response.statusText}`);
    }

    const data: ActionResponse = await response.json();
    return data.success;
  } catch (error) {
    console.error('更新日程状态错误:', error);
    throw error;
  }
}

/**
 * 获取日程类型的显示名称
 */
export function getScheduleTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    medication: '💊 用药',
    exercise: '🏃 运动',
    meal: '🍽️ 饮食',
    checkup: '🏥 检查',
    other: '📝 其他',
  };
  return labels[type] || type;
}

/**
 * 获取日程类型图标
 */
export function getScheduleTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    medication: '💊',
    exercise: '🏃',
    meal: '🍽️',
    checkup: '🏥',
    other: '📝',
  };
  return icons[type] || '📅';
}

/**
 * 格式化时间显示（HH:MM）
 */
export function formatTime(dateTimeStr: string): string {
  try {
    const date = new Date(dateTimeStr);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return dateTimeStr;
  }
}

/**
 * 格式化日期显示（MM月DD日）
 */
export function formatDate(dateTimeStr: string): string {
  try {
    const date = new Date(dateTimeStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  } catch {
    return dateTimeStr;
  }
}

/**
 * 判断日程是否即将开始（15分钟内）
 */
export function isScheduleSoon(scheduleTime: string): boolean {
  try {
    const now = new Date();
    const scheduleDate = new Date(scheduleTime);
    const diffMs = scheduleDate.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes > 0 && diffMinutes <= 15;
  } catch {
    return false;
  }
}

/**
 * 判断日程是否已过期
 */
export function isSchedulePast(scheduleTime: string): boolean {
  try {
    const now = new Date();
    const scheduleDate = new Date(scheduleTime);
    return scheduleDate.getTime() < now.getTime();
  } catch {
    return false;
  }
}

/**
 * 按时间排序日程（从早到晚）
 */
export function sortSchedulesByTime(schedules: Schedule[]): Schedule[] {
  return [...schedules].sort((a, b) => {
    return new Date(a.schedule_time).getTime() - new Date(b.schedule_time).getTime();
  });
}

/**
 * 过滤今日有效日程
 */
export function filterTodaySchedules(schedules: Schedule[]): Schedule[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.schedule_time);
    return scheduleDate >= today && scheduleDate < tomorrow;
  });
}
