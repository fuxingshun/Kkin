/**
 * 老人端消息推送服务
 * 负责向家属端推送SOS、联系家人等消息
 */

import { API_BASE_URL } from '../../config/runtime';

export interface AlertData {
  family_id: string;
  alert_type: 'sos_emergency' | 'contact_family' | 'medication' | 'emotion' | 'inactive' | 'emergency';
  level: 'low' | 'medium' | 'high';
  message: string;
}

/**
 * 推送SOS紧急消息到家属端
 */
export async function sendSOSAlert(familyId: string, elderlyId?: number): Promise<boolean> {
  try {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateStr = `${now.getMonth() + 1}月${now.getDate()}日`;

    const alertData: any = {
      family_id: familyId,
      alert_type: 'sos_emergency',
      level: 'high',
      title: '紧急求助',
      message: `老人触发了紧急求助（${dateStr} ${timeStr}）`,
      metadata: JSON.stringify({
        device: '平板',
        location: '客厅'
      })
    };

    if (elderlyId) {
      alertData.elderly_id = elderlyId;
    }

    const response = await fetch(`${API_BASE_URL}/elderly/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(alertData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('发送SOS消息失败:', errorData);
      return false;
    }

    const data = await response.json();
    console.log('SOS消息发送成功，ID:', data.alert_id);
    return true;
  } catch (error) {
    console.error('发送SOS消息错误:', error);
    return false;
  }
}

/**
 * 推送联系家人消息到家属端
 */
export async function sendContactFamilyAlert(familyId: string, elderlyId?: number): Promise<boolean> {
  try {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateStr = `${now.getMonth() + 1}月${now.getDate()}日`;

    const alertData: any = {
      family_id: familyId,
      alert_type: 'contact_family',
      level: 'medium',
      message: `老人想要联系您（${dateStr} ${timeStr}）`,
    };

    if (elderlyId) {
      alertData.elderly_id = elderlyId;
    }

    const response = await fetch(`${API_BASE_URL}/elderly/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(alertData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('发送联系家人消息失败:', errorData);
      return false;
    }

    const data = await response.json();
    console.log('联系家人消息发送成功，ID:', data.alert_id);
    return true;
  } catch (error) {
    console.error('发送联系家人消息错误:', error);
    return false;
  }
}

/**
 * 推送用药提醒消息到家属端
 */
export async function sendMedicationAlert(
  familyId: string,
  medicationName: string,
  delayMinutes: number,
  elderlyId?: number
): Promise<boolean> {
  try {
    const alertData: any = {
      family_id: familyId,
      alert_type: 'medication',
      level: delayMinutes > 30 ? 'medium' : 'low',
      message: `${medicationName}延迟${delayMinutes}分钟服用`,
    };

    if (elderlyId) {
      alertData.elderly_id = elderlyId;
    }

    const response = await fetch(`${API_BASE_URL}/elderly/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(alertData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('发送用药消息失败:', errorData);
      return false;
    }

    const data = await response.json();
    console.log('用药消息发送成功，ID:', data.alert_id);
    return true;
  } catch (error) {
    console.error('发送用药消息错误:', error);
    return false;
  }
}

/**
 * 推送情绪异常消息到家属端
 */
export async function sendEmotionAlert(
  familyId: string,
  emotionDescription: string,
  elderlyId?: number
): Promise<boolean> {
  try {
    const alertData: any = {
      family_id: familyId,
      alert_type: 'emotion',
      level: 'medium',
      message: emotionDescription,
    };

    if (elderlyId) {
      alertData.elderly_id = elderlyId;
    }

    const response = await fetch(`${API_BASE_URL}/elderly/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(alertData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('发送情绪消息失败:', errorData);
      return false;
    }

    const data = await response.json();
    console.log('情绪消息发送成功，ID:', data.alert_id);
    return true;
  } catch (error) {
    console.error('发送情绪消息错误:', error);
    return false;
  }
}

/**
 * 获取家属的回复消息
 */
export async function getFamilyReplies(elderlyId: number): Promise<any[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/elderly/alerts/replies?elderly_id=${elderlyId}`
    );

    if (!response.ok) {
      throw new Error(`获取回复失败: ${response.statusText}`);
    }

    const data = await response.json();
    return data.replies || [];
  } catch (error) {
    console.error('获取家属回复错误:', error);
    throw error;
  }
}
