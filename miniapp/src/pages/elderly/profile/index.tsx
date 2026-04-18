import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';
import {
  getFamilyUsers,
  getMediaHistory,
  getMoodRecords,
  type FamilyUser,
  type MediaHistoryEntry,
  type MoodRecord,
} from '@/services/elderly';
import { clearElderlySession, getElderlySession } from '@/utils/session';

export default function ElderlyProfilePage() {
  const { familyId, elderlyId, elderName } = getElderlySession();
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [moodRecords, setMoodRecords] = useState<MoodRecord[]>([]);
  const [history, setHistory] = useState<MediaHistoryEntry[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [nextUsers, records, mediaHistory] = await Promise.all([
        getFamilyUsers(familyId),
        getMoodRecords(familyId, elderlyId, 60),
        getMediaHistory(elderlyId, 60),
      ]);
      setUsers(nextUsers);
      setMoodRecords(records);
      setHistory(mediaHistory);
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
  const likedCount = history.filter((item) => item.feedback_type === 'like').length;
  const syncStatus = moodRecords.length || history.length ? '已同步' : '待同步';

  const settingGroups = useMemo(
    () => [
      {
        title: '个人信息',
        items: [
          { icon: '人', label: '基本信息', value: elderly ? `${elderly.name} · ${elderly.phone || '未填写电话'}` : '未绑定老人信息' },
          { icon: '属', label: '已绑定家属', value: `${familyMembers.length}位家属` },
        ],
      },
      {
        title: '适老化设置',
        items: [
          { icon: '字', label: '字体大小', value: '大号' },
          { icon: '亮', label: '高对比模式', value: '已开启' },
          { icon: '播', label: '语音播报', value: '已开启' },
          { icon: '语', label: '语言设置', value: '普通话' },
        ],
      },
      {
        title: '陪伴设置',
        items: [
          { icon: '心', label: '数字人设置', value: '小心 · 温柔陪伴' },
          { icon: '电', label: '求助联系人', value: familyMembers[0]?.name || '待绑定' },
        ],
      },
      {
        title: '数据管理',
        items: [
          { icon: '记', label: '情绪记录', value: `${moodRecords.length}条` },
          { icon: '忆', label: '回忆播放', value: `${history.length}次` },
          { icon: '云', label: '同步状态', value: syncStatus },
        ],
      },
    ],
    [elderly, familyMembers, history.length, moodRecords.length, syncStatus]
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
    <View className='ef-page ef-page--tab'>
      <View className='ef-profile-hero'>
        <View className='ef-profile-avatar'>
          <Text>{(elderly?.name || elderName).slice(0, 1) || '张'}</Text>
        </View>
        <View>
          <Text className='ef-profile-name'>{elderly?.name || elderName}</Text>
          <Text className='ef-profile-desc'>{elderly?.phone || '已连接数据库档案'}</Text>
        </View>
      </View>

      <View className='ef-profile-stats'>
        <View className='ef-profile-stat'><Text>{moodRecords.length}</Text><Text>记录次数</Text></View>
        <View className='ef-profile-stat ef-profile-stat--green'><Text>{history.length}</Text><Text>播放次数</Text></View>
        <View className='ef-profile-stat ef-profile-stat--amber'><Text>{likedCount}</Text><Text>喜欢回忆</Text></View>
      </View>

      <View className='ef-profile-groups'>
        {settingGroups.map((group) => (
          <View className='ef-setting-group' key={group.title}>
            <View className='ef-setting-group__head'>
              <Text>{group.title}</Text>
            </View>
            {group.items.map((item) => (
              <View className='ef-setting-row' key={item.label}>
                <View className='ef-setting-icon'>
                  <Text>{item.icon}</Text>
                </View>
                <View className='ef-setting-row__body'>
                  <Text className='ef-setting-label'>{item.label}</Text>
                  {item.value ? <Text className='ef-setting-value'>{item.value}</Text> : null}
                </View>
                <Text className='ef-chevron'>〉</Text>
              </View>
            ))}
          </View>
        ))}

        <Button className='ef-logout-button' onClick={() => void handleLogout()}>退出登录</Button>

        <View className='ef-version'>
          <Text>老年心理健康陪护平台</Text>
          <Text>家庭档案与陪伴记录实时同步</Text>
        </View>
      </View>

      <ElderlyTabBar active='profile' />
    </View>
  );
}
