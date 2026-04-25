import { useCallback, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { createUser, getFamilyUsers, updateUser, type FamilyUser } from '@/services/elderly';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';
import { getElderlySession, saveElderlySession } from '@/utils/session';

export default function ElderlyBasicInfoPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const { familyId, elderlyId, elderName } = getElderlySession();
  const [elderlyUser, setElderlyUser] = useState<FamilyUser | null>(null);
  const [name, setName] = useState(elderName);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
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
  }, [elderName, elderlyId, familyId]);

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
      });
      Taro.showToast({ title: '基本信息已保存', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className={`ef-page ef-page--sub ${preferenceClassName}`}>
      <View className='ef-topbar'>
        <Text className='ef-topbar__back' onClick={() => Taro.navigateBack()}>〈</Text>
        <Text className='ef-topbar__title'>基本信息</Text>
        <Text className='ef-topbar__space' />
      </View>

      <View className='ef-content-pad'>
        <View className='ef-page-head'>
          <Text className='ef-page-head__title'>修改老人资料</Text>
          <Text className='ef-page-head__desc'>资料会保存到家庭档案，并同步用于老人端展示</Text>
        </View>

        <View className='ef-panel ef-form-panel'>
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
            <View>
              <Text className='ke-label'>家庭档案</Text>
              <View className='ke-input ef-readonly-input'>{familyId}</View>
            </View>
            <Button className='service-button service-button--primary' loading={saving} onClick={() => void handleSave()}>
              保存基本信息
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}
