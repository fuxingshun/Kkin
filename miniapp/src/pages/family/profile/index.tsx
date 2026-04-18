import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';
import { getAlertStats, getFamilySchedules, getFamilyUsers, type FamilyUser, type Schedule } from '@/services/family';

type AlertStats = Awaited<ReturnType<typeof getAlertStats>>;

export default function ProfilePage() {
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [nextUsers, nextSchedules, nextAlertStats] = await Promise.all([
        getFamilyUsers(),
        getFamilySchedules(),
        getAlertStats(),
      ]);
      setUsers(nextUsers);
      setSchedules(nextSchedules);
      setAlertStats(nextAlertStats);
    } catch (error) {
      const message = error instanceof Error ? error.message : '家庭资料加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  const familyUsers = useMemo(() => users.filter((item) => item.user_type === 'family'), [users]);
  const elderUser = useMemo(() => users.find((item) => item.user_type === 'elderly') ?? null, [users]);
  const primaryUser = familyUsers[0] || users[0] || null;

  async function showFamilyMembers() {
    const content = users.length
      ? users.map((item) => `${item.name} · ${item.user_type === 'elderly' ? '老人' : '家属'}`).join('\n')
      : '当前还没有家庭成员数据';

    await Taro.showModal({
      title: '家庭成员',
      content,
      showCancel: false,
    });
  }

  const menu = [
    {
      title: '家庭成员',
      desc: `${users.length} 位成员共同照护`,
      icon: '家',
      action: showFamilyMembers,
    },
    {
      title: '留言安排',
      desc: '查看和新增家人留言',
      icon: '留',
      action: async () => Taro.redirectTo({ url: '/pages/family/messages/index' }),
    },
    {
      title: '护理计划',
      desc: `${schedules.length} 条计划正在运行`,
      icon: '护',
      action: async () => Taro.redirectTo({ url: '/pages/family/care/index' }),
    },
    {
      title: '消息提醒',
      desc: `${alertStats?.status_stats.unhandled ?? 0} 条待处理通知`,
      icon: '通',
      action: async () => Taro.redirectTo({ url: '/pages/family/alerts/index' }),
    },
    {
      title: '情绪周报',
      desc: '查看最近 7 天情绪和照护摘要',
      icon: '报',
      action: async () => Taro.navigateTo({ url: '/pages/family/reports/index' }),
    },
    {
      title: '切换角色',
      desc: '返回角色选择页',
      icon: '换',
      action: async () => Taro.redirectTo({ url: '/pages/role/index' }),
    },
  ] as const;

  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-hero ff-hero--green ff-hero--profile'>
        <View className='ff-profile-avatar'>{(primaryUser?.name || '家').slice(0, 1)}</View>
        <Text className='ff-hero__title'>{primaryUser?.name || '家庭账号'}</Text>
        <Text className='ff-hero__subtitle'>{elderUser ? `正在照护 ${elderUser.name}` : '当前家庭资料待补充'}</Text>
        <View className='ff-stat-grid'>
          <View className='ff-hero-stat'>
            <Text>{familyUsers.length}</Text>
            <Text>家庭成员</Text>
          </View>
          <View className='ff-hero-stat'>
            <Text>{schedules.length}</Text>
            <Text>活跃计划</Text>
          </View>
          <View className='ff-hero-stat'>
            <Text>{alertStats?.status_stats.unhandled ?? 0}</Text>
            <Text>待处理通知</Text>
          </View>
        </View>
      </View>

      <View className='ff-stack ff-stack--overlap'>
        <View className='ff-card'>
          <Text className='ff-section-title'>我的服务</Text>
          <View className='ff-menu-list'>
            {menu.map((item) => (
              <View className='ff-menu-row' key={item.title} onClick={() => void item.action()}>
                <View className='ff-menu-row__icon'>{item.icon}</View>
                <View className='ff-menu-row__body'>
                  <Text>{item.title}</Text>
                  <Text>{item.desc}</Text>
                </View>
                <Text className='ff-chevron'>›</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <BottomNav active='profile' />
    </View>
  );
}
