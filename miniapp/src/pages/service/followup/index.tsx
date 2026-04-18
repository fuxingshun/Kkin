import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';
import {
  advanceFollowupStatus,
  createQuickFollowup,
  getServiceCases,
  getServiceFollowups,
  type ServiceCase,
  type ServiceFollowup,
} from '@/services/service';
import { formatDateTimeText } from '@/utils/format';

function getStatusLabel(status: ServiceFollowup['status']) {
  if (status === 'scheduled') return '待开始';
  if (status === 'in_progress') return '进行中';
  if (status === 'completed') return '已完成';
  return status;
}

export default function ServiceFollowupPage() {
  const [followups, setFollowups] = useState<ServiceFollowup[]>([]);
  const [cases, setCases] = useState<ServiceCase[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [nextFollowups, nextCases] = await Promise.all([
        getServiceFollowups(),
        getServiceCases(),
      ]);
      setFollowups(nextFollowups);
      setCases(nextCases);
    } catch (error) {
      const message = error instanceof Error ? error.message : '随访加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  const todayTasks = useMemo(() => followups.filter((item) => item.status !== 'completed'), [followups]);

  async function createFollowup() {
    const candidates = cases.slice(0, 6);
    if (!candidates.length) {
      Taro.showToast({ title: '暂无可创建随访的老人', icon: 'none' });
      return;
    }

    const result = await Taro.showActionSheet({
      itemList: candidates.map((item) => `${item.name} · ${item.openAlertCount} 条待处理`),
    });

    const selected = candidates[result.tapIndex];
    if (!selected) {
      return;
    }

    try {
      await createQuickFollowup(selected.elderlyId, undefined, 'phone', '服务端新建电话随访');
      Taro.showToast({ title: '随访已创建', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '新建随访失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  async function updateFollowup(item: ServiceFollowup) {
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
      <View className='service-hero service-hero--solid'>
        <View className='service-section__head'>
          <View>
            <Text className='service-kicker'>随访计划</Text>
            <Text className='service-hero__title'>今天按时间跟进</Text>
          </View>
          <Button className='service-hero-button' onClick={() => void createFollowup()}>新建</Button>
        </View>
        <View className='service-stat-grid service-stat-grid--two'>
          <View className='service-stat service-stat--glass'>
            <Text className='service-stat__value'>{todayTasks.length}</Text>
            <Text className='service-stat__label'>待办随访</Text>
          </View>
          <View className='service-stat service-stat--glass'>
            <Text className='service-stat__value'>{followups.filter((item) => item.status === 'completed').length}</Text>
            <Text className='service-stat__label'>已完成</Text>
          </View>
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>随访任务</Text>
        <View className='service-list'>
          {followups.length ? (
            followups.map((item) => (
              <View className='service-follow-card' key={item.id}>
                <View className='service-follow-card__head'>
                  <Text className='service-follow-row__time'>{formatDateTimeText(item.scheduledTime)}</Text>
                  <Text className='service-card-title'>{item.elderlyName}</Text>
                  <Text className='service-chip'>{getStatusLabel(item.status)}</Text>
                </View>
                <Text className='service-card-meta'>{item.consultationType}</Text>
                {item.note ? <Text className='service-card-text'>{item.note}</Text> : null}
                <Button
                  className='service-button service-button--primary'
                  disabled={item.status === 'completed'}
                  onClick={() => void updateFollowup(item)}
                >
                  {item.status === 'scheduled' ? '开始随访' : item.status === 'in_progress' ? '完成随访' : '已完成'}
                </Button>
              </View>
            ))
          ) : (
            <View className='service-follow-card'>
              <Text className='service-card-title'>暂无随访任务</Text>
              <Text className='service-card-meta'>通过右上角“新建”可以快速生成一次电话随访。</Text>
            </View>
          )}
        </View>
      </View>

      <ServiceTabBar active='followup' />
    </View>
  );
}
