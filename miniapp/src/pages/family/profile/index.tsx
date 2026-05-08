import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';
import {
  createPrivacyRequest,
  exportFamilyData,
  getAlertStats,
  getFamilySchedules,
  getFamilyUsers,
  type FamilyUser,
  type Schedule,
} from '@/services/family';
import { getFamilySession, requireCurrentFamilyId } from '@/utils/familySession';
import { useNavigationMetrics } from '@/utils/navigation';

type AlertStats = Awaited<ReturnType<typeof getAlertStats>>;

export default function ProfilePage() {
  const navigation = useNavigationMetrics();
  const [familySession, setFamilySession] = useState(() => getFamilySession());
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [privacySubmitting, setPrivacySubmitting] = useState(false);

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
    setFamilySession(getFamilySession());
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

  function exportSummary(data: Record<string, unknown[]>) {
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.length : 0}`)
      .join('\n');
  }

  async function handleExportData() {
    try {
      setPrivacySubmitting(true);
      requireCurrentFamilyId(familySession);
      const result = await exportFamilyData();
      const exportJson = JSON.stringify(result, null, 2);
      await Taro.setClipboardData({ data: exportJson });
      await Taro.showModal({
        title: '家庭数据已导出',
        content: `已复制到剪贴板。\n${exportSummary(result.data)}`,
        showCancel: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '数据导出失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setPrivacySubmitting(false);
    }
  }

  async function submitPrivacyRequest(type: 'delete' | 'correction') {
    const title = type === 'delete' ? '提交删除请求' : '提交更正请求';
    const content =
      type === 'delete'
        ? '提交后服务人员会核验家庭关系和保留要求，再处理数据删除。'
        : '提交后服务人员会联系确认需要更正的数据范围。';
    const result = await Taro.showModal({
      title,
      content,
      confirmText: '提交',
    });

    if (!result.confirm) {
      return;
    }

    try {
      setPrivacySubmitting(true);
      const familyId = requireCurrentFamilyId(familySession);
      const response = await createPrivacyRequest({
        family_id: familyId,
        elderly_id: elderUser?.id,
        request_type: type,
        requested_by: familySession.familyName || primaryUser?.name || '家属端',
        reason: `${title}：由家属端发起`,
        metadata: {
          source: 'family_profile',
          family_user_id: familySession.familyUserId,
        },
      });
      Taro.showToast({ title: `已提交 #${response.request_id}`, icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求提交失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setPrivacySubmitting(false);
    }
  }

  const menu = [
    {
      title: '绑定老人',
      desc: elderUser ? `已绑定 ${elderUser.name}` : (familySession.bindingCode ? `绑定码 ${familySession.bindingCode}` : '输入绑定码关联老人'),
      icon: '码',
      action: async () => Taro.navigateTo({ url: '/pages/family/bind-elderly/index' }),
    },
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
      <View className='ff-hero ff-hero--green ff-hero--profile' style={navigation.heroStyle}>
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

        <View className='ff-card'>
          <Text className='ff-section-title'>隐私与数据</Text>
          <View className='ff-menu-list'>
            <View className='ff-menu-row' onClick={() => void handleExportData()}>
              <View className='ff-menu-row__icon'>导</View>
              <View className='ff-menu-row__body'>
                <Text>导出家庭数据</Text>
                <Text>{privacySubmitting ? '正在处理请求...' : '复制家庭数据包，包含照护、咨询、媒体和审计摘要'}</Text>
              </View>
              <Text className='ff-chevron'>›</Text>
            </View>
            <View className='ff-menu-row' onClick={() => void submitPrivacyRequest('delete')}>
              <View className='ff-menu-row__icon'>删</View>
              <View className='ff-menu-row__body'>
                <Text>提交删除请求</Text>
                <Text>由服务人员核验后处理数据删除和保留要求</Text>
              </View>
              <Text className='ff-chevron'>›</Text>
            </View>
            <View className='ff-menu-row' onClick={() => void submitPrivacyRequest('correction')}>
              <View className='ff-menu-row__icon'>改</View>
              <View className='ff-menu-row__body'>
                <Text>提交更正请求</Text>
                <Text>登记需要核对或修正的家庭资料</Text>
              </View>
              <Text className='ff-chevron'>›</Text>
            </View>
          </View>
        </View>
      </View>

      <BottomNav active='profile' />
    </View>
  );
}
