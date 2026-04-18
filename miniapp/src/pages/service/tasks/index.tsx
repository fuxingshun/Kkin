import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';
import {
  completeServiceTask,
  getServiceTasks,
  startServiceTask,
  type ServiceTask,
} from '@/services/service';
import { formatDateTimeText } from '@/utils/format';

const tabs = ['待处理', '处理中', '已完成'];

function getPriorityChip(priority: ServiceTask['priority']) {
  if (priority === 'high') return 'service-chip--red';
  if (priority === 'medium') return 'service-chip--amber';
  return 'service-chip';
}

export default function ServiceTasksPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [tasks, setTasks] = useState<ServiceTask[]>([]);

  const loadData = useCallback(async () => {
    try {
      const result = await getServiceTasks();
      setTasks(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '工单加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  const visibleTasks = useMemo(() => {
    if (activeTab === 0) return tasks.filter((item) => item.status === 'pending');
    if (activeTab === 1) return tasks.filter((item) => item.status === 'processing');
    return tasks.filter((item) => item.status === 'completed');
  }, [activeTab, tasks]);

  async function progressTask(item: ServiceTask) {
    try {
      if (item.status === 'pending') {
        await startServiceTask(item.alertId);
        Taro.showToast({ title: '已接单', icon: 'success' });
      } else if (item.status === 'processing') {
        await completeServiceTask(item.alertId);
        Taro.showToast({ title: '已完成处理', icon: 'success' });
      }
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '工单更新失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  return (
    <View className='service-page'>
      <View className='service-topbar'>
        <Text className='service-topbar__title'>工单管理</Text>
        <Text className='service-topbar__desc'>按优先级处理干预和回访。</Text>
      </View>

      <View className='service-tabs'>
        {tabs.map((tab, index) => (
          <View
            key={tab}
            className={`service-tab ${activeTab === index ? 'service-tab--active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            <Text>{tab}</Text>
          </View>
        ))}
      </View>

      <View className='service-list service-list--loose'>
        {visibleTasks.length ? (
          visibleTasks.map((item) => (
            <View className={`service-ticket ${item.priority === 'high' ? 'service-ticket--high' : ''}`} key={item.id}>
              <View className='service-chip-row'>
                <Text className={`service-chip ${getPriorityChip(item.priority)}`}>{item.typeLabel}</Text>
                <Text className='service-ticket__name'>{item.elderlyName}</Text>
              </View>
              <Text className='service-card-text'>{item.reason}</Text>
              <Text className='service-card-meta'>{formatDateTimeText(item.createdAt)}</Text>
              <View className='service-button-row'>
                {item.status !== 'completed' ? (
                  <Button className='service-button service-button--primary' onClick={() => void progressTask(item)}>
                    {item.status === 'pending' ? '开始处理' : '完成处理'}
                  </Button>
                ) : null}
                <Button
                  className='service-button service-button--soft'
                  onClick={() => Taro.navigateTo({ url: `/pages/service/case-detail/index?elderlyId=${item.elderlyId || ''}&alertId=${item.alertId}` })}
                >
                  详情
                </Button>
              </View>
            </View>
          ))
        ) : (
          <View className='service-ticket'>
            <Text className='service-card-title'>当前标签下暂无工单</Text>
            <Text className='service-card-text'>新的异常和待处理提醒会自动同步到这里。</Text>
          </View>
        )}
      </View>

      <ServiceTabBar active='tasks' />
    </View>
  );
}
