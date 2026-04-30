import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';
import {
  getFamilyUsers,
  getMoodRecords,
  type FamilyUser,
  type MoodRecord,
} from '@/services/elderly';
import {
  elderlyAiPersonaOptions,
  elderlyFontSizeOptions,
  elderlyLanguageOptions,
  getElderlyFontSizeLabel,
  getElderlyPreferences,
  saveElderlyPreferences,
  type ElderlyPreferences,
} from '@/utils/elderlyPreferences';
import { clearElderlySession, getElderlySession } from '@/utils/session';

interface SettingItem {
  icon: string;
  label: string;
  value: string;
  action?: () => void | Promise<void>;
}

export default function ElderlyProfilePage() {
  const { familyId, elderlyId, elderName } = getElderlySession();
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [moodRecords, setMoodRecords] = useState<MoodRecord[]>([]);
  const [preferences, setPreferences] = useState<ElderlyPreferences>(() => getElderlyPreferences());

  const loadData = useCallback(async () => {
    try {
      const [nextUsers, records] = await Promise.all([getFamilyUsers(familyId), getMoodRecords(familyId, elderlyId, 60)]);
      setUsers(nextUsers);
      setMoodRecords(records);
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
  const primaryFamilyMember = familyMembers[0] || null;
  const profileName = elderly?.name || (elderName === '张奶奶' ? '张翠花' : elderName) || '张翠花';
  const companionDays = 186;
  const interactionCount = moodRecords.length || 432;
  const favoriteMemories = 28;

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

  function toggleVoiceBroadcast() {
    persistPreferences(
      { voiceBroadcast: !preferences.voiceBroadcast },
      preferences.voiceBroadcast ? '已关闭播报' : '已开启播报'
    );
  }

  async function chooseLanguage() {
    await chooseFromActionSheet(elderlyLanguageOptions, (language) => {
      persistPreferences({ language }, `语言已设为${language}`);
    });
  }

  async function chooseAiPersona() {
    await chooseFromActionSheet(elderlyAiPersonaOptions, (aiPersona) => {
      persistPreferences({ aiPersona }, `陪伴风格已设为${aiPersona}`);
    });
  }

  const personaLabel = preferences.aiPersona === '温柔陪伴' ? '温柔风格' : preferences.aiPersona;

  const settingGroups = useMemo(
    () => [
      {
        title: '个人信息',
        items: [
          {
            icon: '人',
            label: '基本信息',
            value: `${profileName} · 68岁`,
            action: () => Taro.navigateTo({ url: '/pages/elderly/basic-info/index' }),
          },
          {
            icon: '属',
            label: '已绑定家属',
            value: familyMembers.length ? `${familyMembers.length}位家属` : '2位家属',
            action: () => Taro.navigateTo({ url: '/pages/elderly/family-bindings/index' }),
          },
        ],
      },
      {
        title: '适老化设置',
        items: [
          { icon: '字', label: '字体大小', value: getElderlyFontSizeLabel(preferences.fontSize), action: chooseFontSize },
          {
            icon: '亮',
            label: '高对比模式',
            value: preferences.highContrast ? '已开启' : '已关闭',
            action: toggleHighContrast,
          },
          {
            icon: '播',
            label: '语音播报',
            value: preferences.voiceBroadcast ? '已开启' : '已关闭',
            action: toggleVoiceBroadcast,
          },
          { icon: '语', label: '语言设置', value: preferences.language, action: chooseLanguage },
        ],
      },
      {
        title: '陪伴设置',
        items: [
          { icon: '心', label: '数字人设置', value: `小心·${personaLabel}`, action: chooseAiPersona },
          {
            icon: '电',
            label: '求助联系人',
            value: primaryFamilyMember
              ? `${primaryFamilyMember.name}(主)`
              : '女儿(主)',
            action: () => Taro.navigateTo({ url: '/pages/elderly/help/index' }),
          },
        ],
      },
      {
        title: '其他',
        items: [
          {
            icon: '盾',
            label: '隐私说明',
            value: '',
            action: () => Taro.showToast({ title: '隐私说明已同步', icon: 'none' }),
          },
          { icon: '问', label: '帮助中心', value: '', action: () => Taro.navigateTo({ url: '/pages/elderly/help/index' }) },
        ],
      },
    ],
    [familyMembers, personaLabel, preferences, primaryFamilyMember, profileName]
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
    <View className='ef-page ef-page--tab ef-profile-page'>
      <View className='ef-profile-hero'>
        <View className='ef-profile-avatar'>
          <Text>👵</Text>
        </View>
        <View className='ef-profile-hero__body'>
          <Text className='ef-profile-name'>{profileName}</Text>
          <Text className='ef-profile-desc'>68岁 · 已使用{companionDays}天</Text>
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
                  <Text>{item.icon}</Text>
                </View>
                <View className='ef-setting-row__body'>
                  <Text className='ef-setting-label'>{item.label}</Text>
                  {item.value ? <Text className='ef-setting-value'>{item.value}</Text> : null}
                </View>
                {item.action ? <Text className='ef-chevron'>〉</Text> : null}
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
