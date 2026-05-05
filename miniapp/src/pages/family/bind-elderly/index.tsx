import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { bindFamilyByCode } from '@/services/family';
import { getFamilySession, saveFamilySession } from '@/utils/familySession';

function extractBindingCode(value: string) {
  const text = value.trim();
  if (!text) return '';

  const queryMatch = text.match(/[?&](?:binding_code|code)=([^&]+)/i);
  if (queryMatch?.[1]) {
    return decodeURIComponent(queryMatch[1]).trim().toUpperCase();
  }

  const pathMatch = text.match(/([A-Z0-9]{6,16})/i);
  return (pathMatch?.[1] || text).trim().toUpperCase();
}

export default function FamilyBindElderlyPage() {
  const session = getFamilySession();
  const fromLogin = Taro.getCurrentInstance().router?.params?.from === 'login';
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
        wechat_openid: session.wechatOpenid,
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
        if (fromLogin) {
          void Taro.redirectTo({ url: '/pages/family/dashboard/index' });
          return;
        }
        void Taro.navigateBack({
          fail: () => Taro.redirectTo({ url: '/pages/family/dashboard/index' }),
        });
      }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : '绑定失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSaving(false);
    }
  }

  async function handleScanCode() {
    try {
      const result = await Taro.scanCode({ onlyFromCamera: false });
      const nextCode = extractBindingCode(result.result || '');
      if (!nextCode) {
        Taro.showToast({ title: '未识别到绑定码', icon: 'none' });
        return;
      }
      setBindingCode(nextCode);
      Taro.showToast({ title: '已识别绑定码', icon: 'success' });
    } catch {
      Taro.showToast({ title: '扫码已取消', icon: 'none' });
    }
  }

  return (
    <View className='auth-flow-page auth-flow-page--family'>
      <View className='auth-topbar'>
        <Text className='auth-back' onClick={() => Taro.navigateBack({ fail: () => Taro.redirectTo({ url: '/pages/role/index' }) })}>‹</Text>
        <Text className='auth-topbar__title'>绑定长辈</Text>
        <Text className='auth-topbar__space' />
      </View>

      <View className='auth-intro'>
        <View className='auth-mark'>
          <Text>家</Text>
        </View>
        <View className='auth-intro__body'>
          <Text className='auth-kicker'>家属照护端</Text>
          <Text className='auth-title'>绑定长辈</Text>
          <Text className='auth-desc'>输入绑定码或扫码，完成远程守护关联。</Text>
        </View>
      </View>

      <View className='auth-card'>
        <View className='auth-card-head'>
          <Text className='auth-section-title'>绑定信息</Text>
          <Text className='auth-section-note'>远程守护</Text>
        </View>

        <View className='ke-form'>
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
          <Button className='service-button service-button--ghost' disabled={saving} onClick={() => void handleScanCode()}>
            扫描长辈二维码
          </Button>
        </View>
      </View>
    </View>
  );
}
