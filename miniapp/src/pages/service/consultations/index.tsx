import { useMemo, useState } from 'react';
import { Input, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const tabs = ['全部', '待进行', '已完成', '已取消'];

const consultations = [
  {
    id: '1',
    name: '张翠花',
    age: 72,
    time: '今天 09:00',
    type: '视频咨询',
    icon: '▣',
    status: 'scheduled',
    statusLabel: '待进行',
    topic: '焦虑情绪疏导',
    notes: '近期睡眠质量下降，建议进行放松训练和情绪记录。',
  },
  {
    id: '2',
    name: '李秀英',
    age: 68,
    time: '今天 14:30',
    type: '电话咨询',
    icon: '☎',
    status: 'scheduled',
    statusLabel: '待进行',
    topic: '家庭关系沟通',
  },
  {
    id: '3',
    name: '王大爷',
    age: 75,
    time: '今天 16:00',
    type: '视频咨询',
    icon: '▣',
    status: 'scheduled',
    statusLabel: '待进行',
    topic: '孤独感陪伴',
  },
  {
    id: '4',
    name: '赵奶奶',
    age: 70,
    time: '昨天 10:00',
    type: '视频咨询',
    icon: '▣',
    status: 'completed',
    statusLabel: '已完成',
    topic: '情绪低落支持',
    notes: '完成 45 分钟咨询，老人状态有所缓解，需一周后复访。',
  },
  {
    id: '5',
    name: '孙阿姨',
    age: 66,
    time: '昨天 15:30',
    type: '电话咨询',
    icon: '☎',
    status: 'cancelled',
    statusLabel: '已取消',
    topic: '睡眠问题咨询',
  },
];

export default function ServiceConsultationsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [keyword, setKeyword] = useState('');

  const filteredList = useMemo(() => {
    const value = keyword.trim();
    return consultations.filter((item) => {
      const tabMatched = activeTab === 0 || item.statusLabel === tabs[activeTab];
      const keywordMatched = !value || item.name.includes(value) || item.topic.includes(value);
      return tabMatched && keywordMatched;
    });
  }, [activeTab, keyword]);

  return (
    <View className='service-page service-page--figma sc-page'>
      <View className='sc-header'>
        <Text className='sc-title'>咨询管理</Text>
        <View className='sc-search-row'>
          <Input
            className='sc-search'
            value={keyword}
            placeholder='搜索咨询记录'
            onInput={(event) => setKeyword(event.detail.value)}
          />
          <Text className='sc-filter'>筛选</Text>
        </View>
      </View>

      <View className='sc-tabs'>
        {tabs.map((tab, index) => (
          <Text
            key={tab}
            className={`sc-tab ${activeTab === index ? 'sc-tab--active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {tab}
          </Text>
        ))}
      </View>

      <View className='sc-list'>
        {filteredList.map((item) => (
          <View className='sc-consult-card' key={item.id}>
            <View className='sc-consult-card__head'>
              <View className='sc-consult-icon'>
                <Text>{item.icon}</Text>
              </View>
              <View className='sc-consult-card__identity'>
                <Text className='sc-consult-card__name'>{item.name}</Text>
                <Text className='sc-consult-card__meta'>{item.age}岁 · {item.time}</Text>
              </View>
              <Text className={`sc-status sc-status--${item.status}`}>{item.statusLabel}</Text>
            </View>
            <View className='sc-topic-box'>
              <Text className='sc-topic-box__label'>咨询主题</Text>
              <Text className='sc-topic-box__text'>{item.topic}</Text>
            </View>
            {item.notes ? (
              <View className='sc-note-box'>
                <Text>{item.notes}</Text>
              </View>
            ) : null}
            <View className='sc-consult-card__foot'>
              <Text className='sc-consult-type'>{item.type}</Text>
              <View className='sc-action-row'>
                {item.status === 'scheduled' ? (
                  <>
                    <Text className='sc-action sc-action--ghost'>改期</Text>
                    <Text className='sc-action sc-action--primary'>进入咨询室</Text>
                  </>
                ) : (
                  <Text className='sc-action sc-action--ghost'>查看详情</Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>

      <View className='sc-month-card'>
        <Text className='sc-month-card__title'>本月咨询统计</Text>
        <View className='sc-month-grid'>
          <View>
            <Text className='sc-month-value'>28</Text>
            <Text className='sc-month-label'>咨询次数</Text>
          </View>
          <View>
            <Text className='sc-month-value'>56h</Text>
            <Text className='sc-month-label'>服务时长</Text>
          </View>
          <View>
            <Text className='sc-month-value'>4.9</Text>
            <Text className='sc-month-label'>平均评分</Text>
          </View>
        </View>
      </View>

      <ServiceTabBar active='consultations' />
    </View>
  );
}
