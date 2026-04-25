import { useCallback, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import {
  getFamilyUsers,
  sendContactFamilyAlert,
  sendSOSAlert,
  type FamilyUser,
} from '@/services/elderly';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';
import { getElderlySession } from '@/utils/session';

export default function ElderlyHelpPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const { familyId, elderlyId } = getElderlySession();
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [emergencySent, setEmergencySent] = useState(false);
  const [contacts, setContacts] = useState<FamilyUser[]>([]);

  const loadContacts = useCallback(async () => {
    try {
      const users = await getFamilyUsers(familyId);
      setContacts(users.filter((item) => item.user_type === 'family'));
    } catch (error) {
      const message = error instanceof Error ? error.message : '联系人加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, [familyId]);

  useDidShow(() => {
    void loadContacts();
  });

  async function sendEmergency() {
    try {
      await sendSOSAlert(familyId, elderlyId);
      setEmergencySent(true);
      setShowEmergencyConfirm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '发送失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  async function contactFamily(contact?: FamilyUser) {
    try {
      await sendContactFamilyAlert(familyId, elderlyId);
      if (contact?.phone) {
        await Taro.makePhoneCall({ phoneNumber: contact.phone });
      } else {
        Taro.showToast({ title: '已通知家人', icon: 'success' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  if (emergencySent) {
    return (
      <View className={`ef-page ef-page--sub ef-success-screen ${preferenceClassName}`}>
        <View className='ef-success-icon'>✓</View>
        <Text className='ef-success-title'>求助已发送</Text>
        <Text className='ef-success-text'>您的家人已收到求助通知{'\n'}他们会尽快联系您</Text>
        <Button className='ef-blue-button ef-full-button' onClick={() => setEmergencySent(false)}>知道了</Button>
        <Button className='ef-white-button ef-full-button' onClick={() => Taro.redirectTo({ url: '/pages/elderly/home/index' })}>返回首页</Button>
      </View>
    );
  }

  return (
    <View className={`ef-page ef-page--sub ${preferenceClassName}`}>
      <View className='ef-topbar'>
        <Text className='ef-topbar__back' onClick={() => Taro.redirectTo({ url: '/pages/elderly/home/index' })}>〈</Text>
        <Text className='ef-topbar__title'>紧急求助</Text>
        <Text className='ef-topbar__space' />
      </View>

      <View className='ef-help-content'>
        <View className='ef-emergency-card'>
          <View className='ef-emergency-icon'>!</View>
          <Text className='ef-emergency-title'>遇到紧急情况？</Text>
          <Text className='ef-emergency-desc'>点击下方按钮立即通知所有家属联系人</Text>
          <Button className='ef-emergency-button' onClick={() => setShowEmergencyConfirm(true)}>
            发送紧急求助
          </Button>
        </View>

        <View className='ef-panel'>
          <View className='ef-title-row'>
            <View className='ef-square-icon'>电</View>
            <Text className='ef-section-title'>联系家人</Text>
          </View>
          <View className='ef-list'>
            {contacts.length ? (
              contacts.map((contact, index) => (
                <View className={`ef-contact-card ${index === 0 ? 'ef-contact-card--primary' : ''}`} key={contact.id}>
                  <View className='ef-contact-card__head'>
                    <View className='ef-contact-avatar'>{contact.name.slice(0, 1) || '家'}</View>
                    <View className='ef-contact-card__body'>
                      <View className='ef-inline'>
                        <Text className='ef-card-title'>{contact.name}</Text>
                        {index === 0 ? <Text className='ef-primary-badge'>主要</Text> : null}
                      </View>
                      <Text className='ef-card-text'>{index === 0 ? '主要联系人' : '家庭联系人'}</Text>
                    </View>
                  </View>
                  <Text className='ef-contact-phone'>{contact.phone || '未填写电话'}</Text>
                  <Button className='ef-blue-button' onClick={() => contactFamily(contact)}>拨打电话</Button>
                </View>
              ))
            ) : (
              <View className='ef-contact-card'>
                <Text className='ef-card-title'>暂无联系人</Text>
                <Text className='ef-card-text'>家属账号绑定后会显示在这里。</Text>
                <Button className='ef-blue-button' onClick={() => contactFamily()}>通知家人</Button>
              </View>
            )}
          </View>
        </View>

        <View className='ef-tip-card'>
          <Text className='ef-card-title'>使用说明</Text>
          <Text className='ef-tip-line'>· 紧急求助功能会同时通知所有家属联系人，请在真正需要时使用</Text>
          <Text className='ef-tip-line'>· 拨打电话功能会直接呼叫家属，请确保手机信号良好</Text>
          <Text className='ef-tip-line'>· 如需修改联系人信息，请在个人中心进行设置</Text>
        </View>
      </View>

      {showEmergencyConfirm ? (
        <View className='ef-modal-mask'>
          <View className='ef-modal'>
            <View className='ef-modal-icon'>急</View>
            <Text className='ef-modal-title'>确认发送紧急求助？</Text>
            <Text className='ef-modal-desc'>将立即通知所有家属联系人</Text>
            <Button className='ef-emergency-button' onClick={sendEmergency}>
              确认发送
            </Button>
            <Button className='ef-cancel-button' onClick={() => setShowEmergencyConfirm(false)}>取消</Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}
