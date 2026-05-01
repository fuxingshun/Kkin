import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { EmptyState } from '@/components/EmptyState';
import { ServiceTabBar } from '@/components/ServiceTabBar';
import { getLatestMentalScreening, type MentalScreening } from '@/services/mentalHealth';
import {
  advanceFollowupStatus,
  createQuickFollowup,
  getServiceFollowups,
  getServiceOverview,
  getServiceTasks,
  startServiceTask,
  type ServiceFollowup,
  type ServiceOverview,
  type ServiceTask,
} from '@/services/service';
import { formatDateTimeText, formatRelativeTime } from '@/utils/format';

function getPriorityLabel(priority: ServiceTask['priority']) {
  if (priority === 'high') return '高优先级';
  if (priority === 'medium') return '中优先级';
  return '低优先级';
}

function getPriorityTone(priority: ServiceTask['priority']) {
  if (priority === 'high') return 'high';
  if (priority === 'medium') return 'medium';
  return 'low';
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default function ServiceWorkspacePage() {
  const [overview, setOverview] = useState<ServiceOverview | null>(null);
  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [followups, setFollowups] = useState<ServiceFollowup[]>([]);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestScreening, setLatestScreening] = useState<MentalScreening | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nextOverview, nextTasks, nextFollowups, nextScreening] = await Promise.all([
        getServiceOverview(),
        getServiceTasks(undefined, 20),
        getServiceFollowups(undefined, 20),
        getLatestMentalScreening(),
      ]);
      setOverview(nextOverview);
      setTasks(nextTasks);
      setFollowups(nextFollowups);
      setLatestScreening(nextScreening);
    } catch (error) {
      const message = error instanceof Error ? error.message : '服务工作台加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  usePullDownRefresh(() => {
    void loadData();
  });

  const pendingTasks = useMemo(
    () => tasks.filter((item) => item.status === 'pending' || item.status === 'processing').slice(0, 3),
    [tasks]
  );

  const todayFollowups = useMemo(
    () => followups.filter((item) => isToday(item.scheduledTime)).slice(0, 4),
    [followups]
  );

  const weeklyStats = useMemo(() => {
    const stats = overview?.followup_stats;
    return [
      { value: String(stats?.total ?? followups.length), label: '全部随访', tone: 'teal' },
      { value: String(stats?.completed ?? followups.filter((item) => item.status === 'completed').length), label: '已完成', tone: 'green' },
      { value: String(stats?.active ?? followups.filter((item) => item.status !== 'completed').length), label: '待跟进', tone: 'amber' },
      { value: String(overview?.case_stats.high ?? 0), label: '高风险个案', tone: 'indigo' },
    ];
  }, [followups, overview]);

  async function acceptTask(item: ServiceTask) {
    if (item.status !== 'pending') {
      Taro.navigateTo({ url: `/pages/service/case-detail/index?elderlyId=${item.elderlyId || ''}&alertId=${item.alertId}` });
      return;
    }

    try {
      setBusyTaskId(item.id);
      await startServiceTask(item.alertId);
      Taro.showToast({ title: '已接单', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '接单失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setBusyTaskId(null);
    }
  }

  async function deferTask(item: ServiceTask) {
    if (!item.elderlyId) {
      Taro.showToast({ title: '缺少老人信息，无法创建随访', icon: 'none' });
      return;
    }

    try {
      setBusyTaskId(item.id);
      await createQuickFollowup(item.elderlyId, undefined, 'phone', `暂缓处理工单：${item.reason}`);
      Taro.showToast({ title: '已创建随访', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '暂缓失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setBusyTaskId(null);
    }
  }

  async function enterFollowup(item: ServiceFollowup) {
    if (item.status !== 'completed') {
      try {
        await advanceFollowupStatus(item);
        await loadData();
      } catch (error) {
        const message = error instanceof Error ? error.message : '随访状态更新失败';
        Taro.showToast({ title: message, icon: 'none' });
      }
    }

    if (item.elderlyId) {
      Taro.navigateTo({ url: `/pages/service/case-detail/index?elderlyId=${item.elderlyId}` });
    }
  }

  return (
    <View className='service-page service-page--figma'>
      <View className='sw-hero'>
        <View className='sw-hero__top'>
          <View>
            <Text className='sw-kicker'>服务工作台</Text>
            <Text className='sw-title'>今日协同</Text>
          </View>
          <View className='sw-hero__avatar'>
            <Text>服</Text>
          </View>
        </View>
        <View className='sw-stat-grid'>
          <View className='sw-stat-card'>
            <Text className='sw-stat-card__value'>{overview?.followup_stats.active ?? 0}</Text>
            <Text className='sw-stat-card__label'>待随访</Text>
          </View>
          <View className='sw-stat-card'>
            <Text className='sw-stat-card__value'>{overview?.task_stats.pending ?? 0}</Text>
            <Text className='sw-stat-card__label'>待处理</Text>
          </View>
          <View className='sw-stat-card'>
            <Text className='sw-stat-card__value'>{overview?.case_stats.high ?? 0}</Text>
            <Text className='sw-stat-card__label'>高风险</Text>
          </View>
        </View>
      </View>

      <View className='sw-content sw-content--lift'>
        <View className='sw-card'>
          <View className='sw-card__head'>
            <View className='sw-card__title-row'>
              <Text className='sw-card__icon sw-card__icon--amber'>!</Text>
              <Text className='sw-card__title'>待处理工单</Text>
            </View>
            <Text className='sw-link' onClick={() => Taro.redirectTo({ url: '/pages/service/tasks/index' })}>
              查看全部
            </Text>
          </View>
          <View className='sw-list'>
            {pendingTasks.length ? (
              pendingTasks.map((item) => {
                const tone = getPriorityTone(item.priority);
                return (
                  <View className={`sw-request sw-request--${tone}`} key={item.id}>
                    <View className='sw-request__top'>
                      <View>
                        <Text className='sw-request__name'>{item.elderlyName}</Text>
                        <Text className='sw-request__meta'>{formatRelativeTime(item.createdAt)}</Text>
                      </View>
                      <Text className={`sw-badge sw-badge--${tone}`}>{getPriorityLabel(item.priority)}</Text>
                    </View>
                    <Text className='sw-request__topic'>{item.reason}</Text>
                    <View className='sw-request__actions'>
                      <Button
                        className='sw-mini-btn sw-mini-btn--primary'
                        loading={busyTaskId === item.id}
                        onClick={() => void acceptTask(item)}
                      >
                        {item.status === 'pending' ? '接单' : '查看'}
                      </Button>
                      <Button
                        className='sw-mini-btn'
                        loading={busyTaskId === item.id}
                        onClick={() => void deferTask(item)}
                      >
                        暂缓
                      </Button>
                    </View>
                  </View>
                );
              })
            ) : (
              <EmptyState title={loading ? '正在加载工单' : '暂无待处理工单'} hint='新的预警会自动进入服务工单队列。' />
            )}
          </View>
        </View>

        <View className='sw-card'>
          <View className='sw-card__head'>
            <View className='sw-card__title-row'>
              <Text className='sw-card__icon sw-card__icon--teal'>日</Text>
              <Text className='sw-card__title'>今日随访安排</Text>
            </View>
            <Text className='sw-link' onClick={() => Taro.redirectTo({ url: '/pages/service/schedule/index' })}>
              日程
            </Text>
          </View>
          <View className='sw-list'>
            {todayFollowups.length ? (
              todayFollowups.map((item) => (
                <View className='sw-appointment' key={item.id}>
                  <View className='sw-appointment__time'>
                    <Text>{formatDateTimeText(item.scheduledTime).slice(-5)}</Text>
                  </View>
                  <View className='sw-appointment__body'>
                    <View className='sw-appointment__top'>
                      <View className='sw-avatar'>
                        <Text>{item.elderlyName.slice(0, 1)}</Text>
                      </View>
                      <View>
                        <Text className='sw-appointment__name'>{item.elderlyName}</Text>
                        <Text className='sw-appointment__topic'>{item.note || '按计划随访'}</Text>
                      </View>
                    </View>
                    <View className='sw-appointment__bottom'>
                      <Text className='sw-appointment__type'>{item.consultationType}</Text>
                      <Text className='sw-enter-btn' onClick={() => void enterFollowup(item)}>进入随访</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState title={loading ? '正在加载日程' : '今日暂无随访'} hint='可在随访页为高风险个案创建跟进任务。' />
            )}
          </View>
        </View>

        <View className='sw-card'>
          <View className='sw-card__head'>
            <View className='sw-card__title-row'>
              <Text className='sw-card__icon sw-card__icon--indigo'>心</Text>
              <Text className='sw-card__title'>心理筛查动态</Text>
            </View>
            <Text className={`sw-badge sw-badge--${latestScreening?.risk_level === 'low' ? 'low' : 'medium'}`}>
              {latestScreening?.status_label || '暂无记录'}
            </Text>
          </View>
          <View className='sw-warning-row'>
            <Text>{latestScreening?.summary || '老人端完成现场心理关怀检测后，系统会同步最近一次筛查摘要。'}</Text>
            <Text>{latestScreening?.recommendation || '建议结合随访、AI陪伴记录和家属反馈综合判断。'}</Text>
          </View>
        </View>

        <View className='sw-card'>
          <View className='sw-card__title-row sw-card__title-row--solo'>
            <Text className='sw-card__icon sw-card__icon--green'>数</Text>
            <Text className='sw-card__title'>服务数据</Text>
          </View>
          <View className='sw-week-grid'>
            {weeklyStats.map((item) => (
              <View className={`sw-week-card sw-week-card--${item.tone}`} key={item.label}>
                <Text className='sw-week-card__value'>{item.value}</Text>
                <Text className='sw-week-card__label'>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <ServiceTabBar active='workspace' />
    </View>
  );
}
