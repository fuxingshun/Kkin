import { useCallback, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { createUser, getFamilyUsers, updateUser, type FamilyUser } from '@/services/elderly';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';
import { getElderlySession, saveElderlySession } from '@/utils/session';

export default function ElderlyBasicInfoPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const isCreateMode = Taro.getCurrentInstance().router?.params?.mode === 'create';
  const { familyId, elderlyId, elderName, wechatOpenid } = getElderlySession();
  const [elderlyUser, setElderlyUser] = useState<FamilyUser | null>(null);
  const [name, setName] = useState(elderName);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (isCreateMode) {
        setElderlyUser(null);
        return;
      }

      const users = await getFamilyUsers(familyId);
      const current =
        users.find((item) => item.id === elderlyId && item.user_type === 'elderly') ||
        users.find((item) => item.user_type === 'elderly') ||
        null;
      setElderlyUser(current);
      setName(current?.name || elderName);
      setPhone(current?.phone || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : '基本信息加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [elderName, elderlyId, familyId, isCreateMode]);

  useDidShow(() => {
    void loadData();
  });

  async function handleSave() {
    const nextName = name.trim();
    const nextPhone = phone.trim();

    if (!nextName) {
      Taro.showToast({ title: '请填写姓名', icon: 'none' });
      return;
    }

    try {
      setSaving(true);
      const userId = elderlyUser
        ? elderlyUser.id
        : await createUser({
            user_type: 'elderly',
            family_id: familyId,
            name: nextName,
            phone: nextPhone,
            operator: 'elderly',
            wechat_openid: wechatOpenid,
          });

      if (elderlyUser) {
        await updateUser(elderlyUser.id, {
          family_id: familyId,
          name: nextName,
          phone: nextPhone,
          operator: 'elderly',
        });
      }

      saveElderlySession({
        elderlyId: userId,
        elderName: nextName,
        wechatOpenid,
      });
      Taro.showToast({ title: '基本信息已保存', icon: 'success' });
      if (isCreateMode) {
        setTimeout(() => {
          void Taro.redirectTo({ url: '/pages/elderly/home/index' });
        }, 500);
        return;
      }
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className={`auth-flow-page auth-flow-page--elderly ${preferenceClassName}`}>
      <View className='auth-topbar'>
        <Text className='auth-back' onClick={() => Taro.navigateBack({ fail: () => Taro.redirectTo({ url: '/pages/role/index' }) })}>‹</Text>
        <Text className='auth-topbar__title'>基本信息</Text>
        <Text className='auth-topbar__space' />
      </View>

      <View className='auth-intro'>
        <View className='auth-mark'>
          <Text>长</Text>
        </View>
        <View className='auth-intro__body'>
          <Text className='auth-kicker'>老人陪伴端</Text>
          <Text className='auth-title'>{isCreateMode ? '创建老人档案' : '基本资料'}</Text>
          <Text className='auth-desc'>{isCreateMode ? '完成建档后进入陪伴首页。' : '更新老人端展示资料。'}</Text>
        </View>
      </View>

      <View className='auth-card'>
        <View className='auth-card-head'>
          <Text className='auth-section-title'>档案信息</Text>
          <Text className='auth-section-note'>简单填写</Text>
        </View>

        <View className='ke-form'>
          <View>
            <Text className='ke-label'>姓名</Text>
            <Input
              className='ke-input'
              value={name}
              placeholder='请输入老人姓名'
              disabled={loading}
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
              disabled={loading}
              onInput={(event) => setPhone(event.detail.value)}
            />
          </View>

          <Button className='service-button service-button--primary' loading={saving} onClick={() => void handleSave()}>
            {isCreateMode ? '创建并进入首页' : '保存基本信息'}
          </Button>
        </View>
      </View>
    </View>
  );
}
