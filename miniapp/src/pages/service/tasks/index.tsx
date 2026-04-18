import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const taskList = [
  { id: 1, type: '紧急干预', elder: '张翠花', reason: '连续 3 天情绪低落', priority: 'high', status: 'pending' },
  { id: 2, type: '电话回访', elder: '李秀英', reason: '定期心理随访', priority: 'medium', status: 'pending' },
  { id: 3, type: '心理随访', elder: '王大爷', reason: '家属转介', priority: 'medium', status: 'processing' },
];

const tabs = ['待处理', '处理中', '已完成'];

export default function ServiceTasksPage() {
  const [activeTab, setActiveTab] = useState(0);

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
        {taskList.map((item) => (
          <View className={`service-ticket ${item.priority === 'high' ? 'service-ticket--high' : ''}`} key={item.id}>
            <View className='service-chip-row'>
              <Text className={`service-chip ${item.priority === 'high' ? 'service-chip--red' : 'service-chip--amber'}`}>
                {item.type}
              </Text>
              <Text className='service-ticket__name'>{item.elder}</Text>
            </View>
            <Text className='service-card-text'>{item.reason}</Text>
            <View className='service-button-row'>
              <Button className='service-button service-button--primary'>开始处理</Button>
              <Button className='service-button service-button--soft' onClick={() => Taro.navigateTo({ url: `/pages/service/case-detail/index?id=${item.id}` })}>
                详情
              </Button>
            </View>
          </View>
        ))}
      </View>

      <ServiceTabBar active='tasks' />
    </View>
  );
}
