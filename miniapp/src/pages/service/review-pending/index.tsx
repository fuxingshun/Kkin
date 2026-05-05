import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { queryWechatIdentity } from '@/services/auth';
import { getServiceSession, saveServiceSession } from '@/utils/serviceSession';

export default function ServiceReviewPendingPage() {
  const session = getServiceSession();
  const [checking, setChecking] = useState(false);

  async function refreshStatus() {
    if (!session.wechatOpenid) {
      Taro.showToast({ title: '请重新微信授权登录', icon: 'none' });
      return;
    }

    try {
      setChecking(true);
      const identity = await queryWechatIdentity(session.wechatOpenid);
      const service = identity.service;
      saveServiceSession({
        username: service.username || session.username,
        familyId: service.family_id || session.familyId,
        displayName: service.display_name || session.displayName,
        wechatOpenid: session.wechatOpenid,
        certificationStatus: service.status,
      });

      if (service.certified && service.status === 'approved') {
        Taro.showToast({ title: '审核已通过', icon: 'success' });
        setTimeout(() => {
          void Taro.redirectTo({ url: '/pages/service/workspace/index' });
        }, 500);
        return;
      }

      if (service.status === 'rejected') {
        void Taro.redirectTo({ url: '/pages/service/no-access/index?reason=rejected' });
        return;
      }

      Taro.showToast({ title: '仍在审核中', icon: 'none' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '状态查询失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setChecking(false);
    }
  }

  return (
    <View className='auth-flow-page auth-flow-page--service'>
      <View className='auth-topbar'>
        <Text className='auth-back' onClick={() => Taro.redirectTo({ url: '/pages/role/index' })}>‹</Text>
        <Text className='auth-topbar__title'>等待审核</Text>
        <Text className='auth-topbar__space' />
      </View>

      <View className='auth-status-card auth-status-card--top'>
        <View className='auth-status-pill'>审核中</View>
        <Text className='auth-title'>认证资料已提交</Text>
        <Text className='auth-desc'>当前正在等待机构确认。审核通过后，服务协同端会自动开放工作台入口。</Text>
      </View>

      <View className='auth-card'>
        <Text className='auth-section-title'>审核进度</Text>
        <View className='auth-timeline'>
          <View className='auth-timeline-row auth-timeline-row--done'>
            <Text className='auth-timeline-dot' />
            <View>
              <Text className='auth-timeline-title'>微信授权</Text>
              <Text className='auth-timeline-note'>已获取当前账号身份</Text>
            </View>
          </View>
          <View className='auth-timeline-row auth-timeline-row--done'>
            <Text className='auth-timeline-dot' />
            <View>
              <Text className='auth-timeline-title'>资料提交</Text>
              <Text className='auth-timeline-note'>认证信息已送达机构</Text>
            </View>
          </View>
          <View className='auth-timeline-row'>
            <Text className='auth-timeline-dot' />
            <View>
              <Text className='auth-timeline-title'>机构审核</Text>
              <Text className='auth-timeline-note'>请等待管理员确认服务资质</Text>
            </View>
          </View>
        </View>
      </View>

      <View className='auth-action-panel'>
        <Button className='service-button service-button--primary' loading={checking} onClick={() => void refreshStatus()}>
          刷新审核状态
        </Button>
        <Button className='service-button service-button--ghost' onClick={() => Taro.redirectTo({ url: '/pages/role/index' })}>
          返回身份选择
        </Button>
      </View>
    </View>
  );
}
