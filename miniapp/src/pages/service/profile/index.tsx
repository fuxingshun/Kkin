import { useCallback, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';
import { getServiceOverview, type ServiceOverview } from '@/services/service';
import { getServiceSession } from '@/utils/serviceSession';

const menuItems = [
  { title: '个人信息', desc: '服务人员资料与执业信息', path: '/pages/service/workspace/index' },
  { title: '重点个案', desc: '查看当前重点老人和风险分层', path: '/pages/service/cases/index' },
  { title: '工单处理', desc: '进入待处理与处理中工单列表', path: '/pages/service/tasks/index' },
  { title: '随访安排', desc: '查看并推进随访计划', path: '/pages/service/followup/index' },
];

export default function ServiceProfilePage() {
  const [serviceSession, setServiceSession] = useState(() => getServiceSession());
  const [overview, setOverview] = useState<ServiceOverview | null>(null);

  const loadData = useCallback(async () => {
    try {
      setServiceSession(getServiceSession());
      const nextOverview = await getServiceOverview();
      setOverview(nextOverview);
    } catch (error) {
      const message = error instanceof Error ? error.message : '服务概况加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  return (
    <View className='service-page'>
      <View className='service-hero service-hero--solid'>
        <View className='service-profile-head'>
          <View className='service-profile-head__avatar'>
            <Text>服</Text>
          </View>
          <View>
            <Text className='service-hero__title'>{serviceSession.displayName || '服务人员中心'}</Text>
            <Text className='service-hero__subtitle'>把个案、工单和随访统一收口管理</Text>
          </View>
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>工作概况</Text>
        <View className='service-two-grid'>
          <View className='service-info-box'>
            <Text className='service-stat__value'>{overview?.task_stats.pending ?? 0}</Text>
            <Text className='service-card-meta'>待处理工单</Text>
          </View>
          <View className='service-info-box'>
            <Text className='service-stat__value'>{overview?.followup_stats.active ?? 0}</Text>
            <Text className='service-card-meta'>进行中随访</Text>
          </View>
          <View className='service-info-box'>
            <Text className='service-stat__value'>{overview?.case_stats.high ?? 0}</Text>
            <Text className='service-card-meta'>高风险个案</Text>
          </View>
          <View className='service-info-box'>
            <Text className='service-stat__value'>{overview?.task_stats.completed ?? 0}</Text>
            <Text className='service-card-meta'>已闭环工单</Text>
          </View>
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>工作入口</Text>
        <View className='service-list'>
          {menuItems.map((item) => (
            <View
              className='service-menu-row'
              key={item.title}
              onClick={() => Taro.redirectTo({ url: item.path })}
            >
              <View>
                <Text className='service-card-title'>{item.title}</Text>
                <Text className='service-card-text'>{item.desc}</Text>
              </View>
              <Text className='service-link'>进入</Text>
            </View>
          ))}
        </View>
      </View>

      <ServiceTabBar active='profile' />
    </View>
  );
}
