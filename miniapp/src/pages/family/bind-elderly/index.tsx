import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { bindFamilyByCode } from '@/services/family';
import { getFamilySession, saveFamilySession } from '@/utils/familySession';

export default function FamilyBindElderlyPage() {
  const session = getFamilySession();
  const [bindingCode, setBindingCode] = useState(session.bindingCode || '');
  const [name, setName] = useState(session.familyName || '');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleBind() {
    const nextCode = bindingCode.trim().toUpperCase();
    const nextName = name.trim();
    const nextPhone = phone.trim();

    if (!nextCode) {
      Taro.showToast({ title: '请输入绑定码', icon: 'none' });
      return;
    }

    if (!nextName) {
      Taro.showToast({ title: '请输入家属姓名', icon: 'none' });
      return;
    }

    try {
      setSaving(true);
      const result = await bindFamilyByCode({
        binding_code: nextCode,
        name: nextName,
        phone: nextPhone,
      });

      saveFamilySession({
        familyId: result.family_id,
        familyUserId: result.user_id,
        familyName: nextName,
        elderlyId: result.elderly_id,
        elderlyName: result.elderly_name,
        bindingCode: result.binding_code,
      });

      Taro.showToast({ title: '绑定成功', icon: 'success' });
      setTimeout(() => {
        void Taro.navigateBack({
          fail: () => Taro.switchTab({ url: '/pages/family/profile/index' }),
        });
      }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : '绑定失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-sub-topbar'>
        <Text
          className='ff-back'
          onClick={() => Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/family/profile/index' }) })}
        >
          ‹
        </Text>
        <Text className='ff-sub-topbar__title'>绑定老人</Text>
        <Text className='ff-sub-topbar__spacer'> </Text>
      </View>

      <View className='ff-stack ff-stack--page'>
        <View className='ff-card'>
          <Text className='ff-section-title'>输入老人绑定码</Text>
          <Text className='ff-card-subtitle'>请向老人端索取绑定码，输入后即可完成家庭关联。</Text>

          <View className='ke-form' style={{ marginTop: '20rpx' }}>
            <View>
              <Text className='ke-label'>绑定码</Text>
              <Input
                className='ke-input'
                value={bindingCode}
                placeholder='例如 8A3F1C2D'
                onInput={(event) => setBindingCode(event.detail.value.toUpperCase())}
              />
            </View>

            <View>
              <Text className='ke-label'>家属姓名</Text>
              <Input
                className='ke-input'
                value={name}
                placeholder='请输入家属姓名'
                onInput={(event) => setName(event.detail.value)}
              />
            </View>

            <View>
              <Text className='ke-label'>联系电话</Text>
              <Input
                className='ke-input'
                value={phone}
                type='number'
                placeholder='请输入联系电话'
                onInput={(event) => setPhone(event.detail.value)}
              />
            </View>

            <Button className='service-button service-button--primary' loading={saving} onClick={() => void handleBind()}>
              确认绑定
            </Button>
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>当前关联</Text>
          <Text className='ff-card-subtitle'>
            {session.elderlyName ? `已关联老人：${session.elderlyName}` : '尚未绑定老人，绑定后家庭数据会自动切换。'}
          </Text>
        </View>
      </View>
    </View>
  );
}
