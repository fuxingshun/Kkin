import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';
import {
  advanceFollowupStatus,
  getServiceCases,
  getServiceFollowups,
  getServiceOverview,
  getServiceTasks,
  startServiceTask,
  type ServiceOverview,
  type ServiceCase,
  type ServiceFollowup,
  type ServiceTask,
} from '@/services/service';
import { formatDateTimeText } from '@/utils/format';
import { getServiceSession } from '@/utils/serviceSession';

function getPriorityClass(priority: ServiceTask['priority']) {
  return priority === 'high' ? 'service-ticket--high' : '';
}

function getPriorityChip(priority: ServiceTask['priority']) {
  return priority === 'high' ? 'service-chip--red' : priority === 'medium' ? 'service-chip--amber' : 'service-chip';
}

function getRiskLabel(risk: ServiceCase['risk']) {
  if (risk === 'high') return '高风险';
  if (risk === 'medium') return '中风险';
  return '低风险';
}

function getRiskChip(risk: ServiceCase['risk']) {
  if (risk === 'high') return 'service-chip--red';
  if (risk === 'medium') return 'service-chip--amber';
  return 'service-chip--green';
}

function getFollowupButtonLabel(item: ServiceFollowup) {
  if (item.status === 'scheduled') return '开始';
  if (item.status === 'in_progress') return '完成';
  return '已完成';
}

export default function ServiceWorkspacePage() {
  const [serviceSession, setServiceSession] = useState(() => getServiceSession());
  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [cases, setCases] = useState<ServiceCase[]>([]);
  const [followups, setFollowups] = useState<ServiceFollowup[]>([]);
  const [overview, setOverview] = useState<ServiceOverview | null>(null);

  const loadData = useCallback(async () => {
    try {
      setServiceSession(getServiceSession());
      const [nextTasks, nextCases, nextFollowups, nextOverview] = await Promise.all([
        getServiceTasks(),
        getServiceCases(),
        getServiceFollowups(),
        getServiceOverview(),
      ]);
      setTasks(nextTasks);
      setCases(nextCases);
      setFollowups(nextFollowups);
      setOverview(nextOverview);
    } catch (error) {
      const message = error instanceof Error ? error.message : '工作台加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  const openTasks = useMemo(() => tasks.filter((item) => item.status !== 'completed'), [tasks]);
  const openCases = useMemo(() => cases.filter((item) => item.risk !== 'low').slice(0, 5), [cases]);
  const activeFollowups = useMemo(
    () => followups.filter((item) => item.status !== 'completed').slice(0, 5),
    [followups]
  );

  async function handleTask(task: ServiceTask) {
    try {
      if (task.status === 'pending') {
        await startServiceTask(task.alertId);
      }
      await Taro.navigateTo({
        url: `/pages/service/case-detail/index?elderlyId=${task.elderlyId || ''}&alertId=${task.alertId}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '处理工单失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  async function handleFollowup(item: ServiceFollowup) {
    if (item.status === 'completed') {
      return;
    }

    try {
      await advanceFollowupStatus(item);
      Taro.showToast({ title: '随访状态已更新', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新随访失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  return (
    <View className='service-page'>
      <View className='service-hero'>
        <View className='service-hero__top'>
          <View>
            <Text className='service-kicker'>{serviceSession.displayName || '服务专员'}</Text>
            <Text className='service-hero__title'>服务工作台</Text>
            <Text className='service-hero__subtitle'>高风险个案、工单和随访安排都在这里。</Text>
          </View>
          <View className='service-avatar'>
            <Text>服</Text>
          </View>
        </View>
        <View className='service-stat-grid'>
          <View className='service-stat service-stat--glass'>
            <Text className='service-stat__value'>{overview?.task_stats.pending ?? openTasks.length}</Text>
            <Text className='service-stat__label'>待处理工单</Text>
          </View>
          <View className='service-stat service-stat--glass'>
            <Text className='service-stat__value'>{(overview?.case_stats.high ?? 0) + (overview?.case_stats.medium ?? 0) || openCases.length}</Text>
            <Text className='service-stat__label'>重点个案</Text>
          </View>
          <View className='service-stat service-stat--glass'>
            <Text className='service-stat__value'>{overview?.followup_stats.active ?? activeFollowups.length}</Text>
            <Text className='service-stat__label'>今日随访</Text>
          </View>
        </View>
      </View>

      <View className='service-section service-section--lift'>
        <View className='service-section__head'>
          <Text className='service-section__title'>今日待处理工单</Text>
          <Text className='service-link' onClick={() => Taro.redirectTo({ url: '/pages/service/tasks/index' })}>
            查看全部
          </Text>
        </View>
        <View className='service-list'>
          {openTasks.length ? (
            openTasks.slice(0, 3).map((task) => (
              <View key={task.id} className={`service-ticket ${getPriorityClass(task.priority)}`}>
                <View className='service-chip-row'>
                  <Text className={`service-chip ${getPriorityChip(task.priority)}`}>{task.typeLabel}</Text>
                  <Text className='service-ticket__name'>{task.elderlyName}</Text>
                </View>
                <Text className='service-card-text'>{task.reason}</Text>
                <Button className='service-button service-button--primary' onClick={() => void handleTask(task)}>
                  {task.status === 'pending' ? '立即处理' : '继续处理'}
                </Button>
              </View>
            ))
          ) : (
            <View className='service-ticket'>
              <Text className='service-card-title'>暂无待处理工单</Text>
              <Text className='service-card-text'>老人端新的异常、求助或提醒会实时进入这里。</Text>
            </View>
          )}
        </View>
      </View>

      <View className='service-section'>
        <View className='service-section__head'>
          <Text className='service-section__title'>重点老人</Text>
          <Text className='service-link' onClick={() => Taro.redirectTo({ url: '/pages/service/cases/index' })}>
            查看全部
          </Text>
        </View>
        <View className='service-list'>
          {openCases.length ? (
            openCases.map((item) => (
              <View
                className='service-case-row'
                key={item.elderlyId}
                onClick={() => Taro.navigateTo({ url: `/pages/service/case-detail/index?elderlyId=${item.elderlyId}&alertId=${item.latestAlertId || ''}` })}
              >
                <View className='service-case-row__avatar'>
                  <Text>{item.name.slice(0, 1)}</Text>
                </View>
                <View className='service-case-row__body'>
                  <Text className='service-card-title'>{item.name}</Text>
                  <Text className='service-card-meta'>最近联系：{item.lastHelpAt ? formatDateTimeText(item.lastHelpAt) : '暂无'}</Text>
                </View>
                <Text className={`service-chip ${getRiskChip(item.risk)}`}>{getRiskLabel(item.risk)}</Text>
              </View>
            ))
          ) : (
            <View className='service-case-row'>
              <View className='service-case-row__body'>
                <Text className='service-card-title'>暂无高优先级个案</Text>
                <Text className='service-card-meta'>当前没有需要优先跟进的老人。</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View className='service-section'>
        <View className='service-section__head'>
          <Text className='service-section__title'>今日随访任务</Text>
          <Text className='service-section__desc'>{activeFollowups.length} 个任务</Text>
        </View>
        <View className='service-list'>
          {activeFollowups.length ? (
            activeFollowups.map((item) => (
              <View className='service-follow-row' key={item.id}>
                <Text className='service-follow-row__time'>{formatDateTimeText(item.scheduledTime)}</Text>
                <View className='service-follow-row__body'>
                  <Text className='service-card-title'>{item.elderlyName}</Text>
                  <Text className='service-card-meta'>{item.consultationType}</Text>
                </View>
                <Button
                  className='service-mini-button'
                  disabled={item.status === 'completed'}
                  onClick={() => void handleFollowup(item)}
                >
                  {getFollowupButtonLabel(item)}
                </Button>
              </View>
            ))
          ) : (
            <View className='service-follow-row'>
              <View className='service-follow-row__body'>
                <Text className='service-card-title'>暂无随访安排</Text>
                <Text className='service-card-meta'>新的咨询预约和服务记录会汇总到这里。</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View className='service-action-grid'>
        <View className='service-action-tile' onClick={() => Taro.redirectTo({ url: '/pages/service/cases/index' })}>
          <Text>查看个案</Text>
        </View>
        <View className='service-action-tile' onClick={() => Taro.redirectTo({ url: '/pages/service/followup/index' })}>
          <Text>创建随访</Text>
        </View>
        <View className='service-action-tile' onClick={() => Taro.redirectTo({ url: '/pages/service/tasks/index' })}>
          <Text>处理工单</Text>
        </View>
      </View>

      <ServiceTabBar active='workspace' />
    </View>
  );
}
