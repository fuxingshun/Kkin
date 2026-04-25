import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import {
  deleteFamilyUser,
  getFamilyUsers,
  getUserBindingCode,
  type BindingCodeInfo,
  type FamilyUser,
} from '@/services/elderly';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';
import { getElderlySession } from '@/utils/session';

export default function ElderlyFamilyBindingsPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const { familyId, elderlyId } = getElderlySession();
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [bindingInfo, setBindingInfo] = useState<BindingCodeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const familyMembers = useMemo(() => users.filter((item) => item.user_type === 'family'), [users]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nextUsers, nextBindingInfo] = await Promise.all([
        getFamilyUsers(familyId),
        getUserBindingCode(elderlyId, familyId),
      ]);
      setUsers(nextUsers);
      setBindingInfo(nextBindingInfo);
    } catch (error) {
      const message = error instanceof Error ? error.message : '家属信息加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [elderlyId, familyId]);

  useDidShow(() => {
    void loadData();
  });

  async function copyBindingCode() {
    if (!bindingInfo?.binding_code) {
      return;
    }

    try {
      await Taro.setClipboardData({ data: bindingInfo.binding_code });
      Taro.showToast({ title: '绑定码已复制', icon: 'success' });
    } catch {
      Taro.showToast({ title: '复制失败，请稍后重试', icon: 'none' });
    }
  }

  async function handleDelete(member: FamilyUser) {
    const result = await Taro.showModal({
      title: '删除绑定家属',
      content: `确认删除 ${member.name} 吗？删除后该家属将无法继续查看当前老人相关数据。`,
      confirmText: '删除',
      confirmColor: '#dc2626',
      cancelText: '取消',
    });

    if (!result.confirm) {
      return;
    }

    try {
      setDeletingId(member.id);
      await deleteFamilyUser(member.id, familyId, 'elderly');
      Taro.showToast({ title: '家属已删除', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <View className={`ef-page ef-page--sub ${preferenceClassName}`}>
      <View className='ef-topbar'>
        <Text
          className='ef-topbar__back'
          onClick={() => Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/elderly/profile/index' }) })}
        >
          ‹
        </Text>
        <Text className='ef-topbar__title'>绑定家属</Text>
        <Text className='ef-topbar__space' />
      </View>

      <View className='ef-content-pad'>
        <View className='ef-page-head'>
          <Text className='ef-page-head__title'>管理家属联系人</Text>
          <Text className='ef-page-head__desc'>把绑定码发给家属，由家属端输入绑定码完成关联。</Text>
        </View>

        <View className='ef-panel ef-form-panel'>
          <Text className='ef-card-title'>当前绑定码</Text>
          <View className='ef-form-panel__body'>
            <View className='ef-binding-code-card'>
              <Text className='ef-binding-code-card__value'>{bindingInfo?.binding_code || '加载中...'}</Text>
              <Text className='ef-card-text'>家属端输入该绑定码，并填写自己的姓名和联系电话后，才能完成绑定。</Text>
              <Button
                className='service-button service-button--primary'
                disabled={!bindingInfo?.binding_code || loading}
                onClick={() => void copyBindingCode()}
              >
                复制绑定码
              </Button>
            </View>
          </View>
        </View>

        <View className='ef-panel ef-form-panel'>
          <Text className='ef-card-title'>已绑定家属</Text>
          <View className='ef-list'>
            {familyMembers.length ? (
              familyMembers.map((member, index) => (
                <View className='ef-family-member-card' key={member.id}>
                  <View className='ef-family-member-card__avatar'>{member.name.slice(0, 1) || '家'}</View>
                  <View className='ef-family-member-card__body'>
                    <View className='ef-inline'>
                      <Text className='ef-card-title'>{member.name}</Text>
                      {index === 0 ? <Text className='ef-primary-badge'>主要</Text> : null}
                    </View>
                    <Text className='ef-card-text'>{member.phone || '未填写电话'}</Text>
                  </View>
                  <View className='ef-family-member-card__actions'>
                    <Button
                      className='ke-button--danger ef-family-member-card__action'
                      loading={deletingId === member.id}
                      onClick={() => void handleDelete(member)}
                    >
                      删除
                    </Button>
                  </View>
                </View>
              ))
            ) : (
              <View className='ef-empty-card'>
                <Text className='ef-card-title'>暂无绑定家属</Text>
                <Text className='ef-card-text'>家属使用绑定码完成关联后，会自动出现在这里。</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
