import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';
import {
  getElderlyProfileStats,
  getFamilyUsers,
  type ElderlyProfileStats,
  type FamilyUser,
} from '@/services/elderly';
import {
  elderlyFontSizeOptions,
  getElderlyFontSizeLabel,
  getElderlyPreferences,
  saveElderlyPreferences,
  useElderlyPreferenceClassNames,
  type ElderlyPreferences,
} from '@/utils/elderlyPreferences';
import { clearElderlySession, getElderlySession } from '@/utils/session';

interface SettingItem {
  icon: AppIconName;
  label: string;
  value: string;
  action?: () => void | Promise<void>;
}

export default function ElderlyProfilePage() {
  const { familyId, elderlyId, elderName } = getElderlySession();
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [profileStats, setProfileStats] = useState<ElderlyProfileStats | null>(null);
  const [preferences, setPreferences] = useState<ElderlyPreferences>(() => getElderlyPreferences());
  const preferenceClassName = useElderlyPreferenceClassNames();

  const loadData = useCallback(async () => {
    try {
      const [nextUsers, stats] = await Promise.all([
        getFamilyUsers(familyId),
        getElderlyProfileStats(familyId, elderlyId),
      ]);
      setUsers(nextUsers);
      setProfileStats(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, [elderlyId, familyId]);

  useDidShow(() => {
    void loadData();
  });

  const elderly = users.find((item) => item.user_type === 'elderly');
  const familyMembers = users.filter((item) => item.user_type === 'family');
  const profileName = elderly?.name || (elderName === '张奶奶' ? '张翠花' : elderName) || '张翠花';
  const companionDays = profileStats?.companion_days ?? 0;
  const interactionCount = profileStats?.interaction_count ?? 0;
  const favoriteMemories = profileStats?.favorite_memories ?? 0;
  const profileInitial = profileName.slice(0, 1) || '长';

  function persistPreferences(patch: Partial<ElderlyPreferences>, title = '设置已保存') {
    const next = saveElderlyPreferences(patch);
    setPreferences(next);
    Taro.showToast({ title, icon: 'success' });
  }

  function ignoreActionSheetCancel(error: unknown) {
    const message = error instanceof Error ? error.message : String((error as { errMsg?: string })?.errMsg || '');
    if (!message.includes('cancel')) {
      Taro.showToast({ title: message || '操作取消', icon: 'none' });
    }
  }

  async function chooseFromActionSheet<T extends string>(
    itemList: T[],
    onSelect: (value: T, index: number) => void | Promise<void>
  ) {
    try {
      const result = await Taro.showActionSheet({ itemList });
      const selected = itemList[result.tapIndex];
      if (selected) {
        await onSelect(selected, result.tapIndex);
      }
    } catch (error) {
      ignoreActionSheetCancel(error);
    }
  }

  async function chooseFontSize() {
    await chooseFromActionSheet(
      elderlyFontSizeOptions.map((item) => item.label),
      (label, index) => {
        const option = elderlyFontSizeOptions[index];
        persistPreferences({ fontSize: option.value }, `已切换为${label}`);
      }
    );
  }

  function toggleHighContrast() {
    persistPreferences(
      { highContrast: !preferences.highContrast },
      preferences.highContrast ? '已关闭高对比' : '已开启高对比'
    );
  }

  const settingGroups = useMemo(
    () => [
      {
        title: '个人信息',
        items: [
          {
            icon: 'user',
            label: '基本信息',
            value: elderly?.phone ? `${profileName} · ${elderly.phone}` : profileName,
            action: () => Taro.navigateTo({ url: '/pages/elderly/basic-info/index' }),
          },
          {
            icon: 'users',
            label: '已绑定家属',
            value: familyMembers.length ? `${familyMembers.length}位家属` : '暂无绑定家属',
            action: () => Taro.navigateTo({ url: '/pages/elderly/family-bindings/index' }),
          },
        ],
      },
      {
        title: '适老化设置',
        items: [
          { icon: 'text', label: '字体大小', value: getElderlyFontSizeLabel(preferences.fontSize), action: chooseFontSize },
          {
            icon: 'check',
            label: '高对比模式',
            value: preferences.highContrast ? '已开启' : '已关闭',
            action: toggleHighContrast,
          },
        ],
      },
      {
        title: '其他',
        items: [
          {
            icon: 'shield',
            label: '隐私说明',
            value: '',
            action: () => Taro.showToast({ title: '隐私说明已同步', icon: 'none' }),
          },
          { icon: 'help', label: '帮助中心', value: '', action: () => Taro.navigateTo({ url: '/pages/elderly/help/index' }) },
        ],
      },
    ],
    [elderly?.phone, familyMembers, preferences, profileName]
  );

  async function handleLogout() {
    const result = await Taro.showModal({
      title: '退出登录',
      content: '退出后将返回角色选择页，需要重新进入对应端口。',
      confirmText: '退出',
      cancelText: '取消',
    });

    if (!result.confirm) {
      return;
    }

    clearElderlySession();
    await Taro.reLaunch({ url: '/pages/role/index' });
  }

  return (
    <View className={`ef-page ef-page--tab ef-profile-page ${preferenceClassName}`}>
      <View className='ef-profile-hero'>
        <View className='ef-profile-avatar'>
          <Text>{profileInitial}</Text>
        </View>
        <View className='ef-profile-hero__body'>
          <Text className='ef-profile-name'>{profileName}</Text>
          <Text className='ef-profile-desc'>已使用{companionDays}天</Text>
        </View>
      </View>

      <View className='ef-profile-stats'>
        <View className='ef-profile-stat'><Text>{companionDays}</Text><Text>陪伴天数</Text></View>
        <View className='ef-profile-stat ef-profile-stat--green'><Text>{interactionCount}</Text><Text>互动次数</Text></View>
        <View className='ef-profile-stat ef-profile-stat--amber'><Text>{favoriteMemories}</Text><Text>收藏回忆</Text></View>
      </View>

      <View className='ef-profile-groups'>
        {settingGroups.map((group) => (
          <View className='ef-setting-group' key={group.title}>
            <View className='ef-setting-group__head'>
              <Text>{group.title}</Text>
            </View>
            {(group.items as SettingItem[]).map((item) => (
              <View
                className={`ef-setting-row ${item.action ? '' : 'ef-setting-row--readonly'}`}
                key={item.label}
                onClick={item.action ? () => void item.action?.() : undefined}
              >
                <View className='ef-setting-icon'>
                  <AppIcon name={item.icon} />
                </View>
                <View className='ef-setting-row__body'>
                  <Text className='ef-setting-label'>{item.label}</Text>
                  {item.value ? <Text className='ef-setting-value'>{item.value}</Text> : null}
                </View>
                {item.action ? <AppIcon name='chevron-right' className='ef-chevron' /> : null}
              </View>
            ))}
          </View>
        ))}

        <Button className='ef-logout-button' onClick={() => void handleLogout()}>退出登录</Button>

        <View className='ef-version'>
          <Text>老年心理健康陪护平台</Text>
          <Text>版本 1.0.0</Text>
        </View>
      </View>

      <ElderlyTabBar active='profile' />
    </View>
  );
}
