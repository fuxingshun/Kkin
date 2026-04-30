import { useMemo, useState } from 'react';
import Taro from '@tarojs/taro';
import { Input, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const tabs = ['全部', '高风险', '中风险', '低风险'];

const cases = [
  {
    id: '1',
    name: '张翠花',
    age: 72,
    community: '阳光社区',
    risk: 'high',
    riskLabel: '高风险',
    lastEmotion: '焦虑',
    consultationCount: 8,
    lastConsultation: '2026-04-24',
    summary: '近期睡眠质量下降，独居时间较长，需要重点关注焦虑波动。',
  },
  {
    id: '2',
    name: '李秀英',
    age: 68,
    community: '幸福里社区',
    risk: 'medium',
    riskLabel: '中风险',
    lastEmotion: '平稳',
    consultationCount: 5,
    lastConsultation: '2026-04-23',
    summary: '家庭沟通存在压力，已建立稳定咨询节奏。',
  },
  {
    id: '3',
    name: '王大爷',
    age: 75,
    community: '春晖社区',
    risk: 'medium',
    riskLabel: '中风险',
    lastEmotion: '孤独',
    consultationCount: 6,
    lastConsultation: '2026-04-22',
    summary: '子女陪伴较少，社交活动参与度需要逐步提升。',
  },
  {
    id: '4',
    name: '赵奶奶',
    age: 70,
    community: '康乐社区',
    risk: 'low',
    riskLabel: '低风险',
    lastEmotion: '愉快',
    consultationCount: 3,
    lastConsultation: '2026-04-20',
    summary: '情绪状态较稳定，继续保持每周一次轻量跟进。',
  },
];

export default function ServiceCasesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [keyword, setKeyword] = useState('');

  const filteredCases = useMemo(() => {
    const value = keyword.trim();
    return cases.filter((item) => {
      const tabMatched = activeTab === 0 || item.riskLabel === tabs[activeTab];
      const keywordMatched = !value || item.name.includes(value) || item.community.includes(value);
      return tabMatched && keywordMatched;
    });
  }, [activeTab, keyword]);

  return (
    <View className='service-page service-page--figma sc-page'>
      <View className='sc-header'>
        <Text className='sc-title'>个案管理</Text>
        <View className='sc-search-row'>
          <Input
            className='sc-search'
            value={keyword}
            placeholder='搜索老人姓名或社区'
            onInput={(event) => setKeyword(event.detail.value)}
          />
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
        {filteredCases.map((item) => (
          <View
            className='sc-case-card'
            key={item.id}
            onClick={() => Taro.navigateTo({ url: `/pages/service/case-detail/index?elderlyId=${item.id}` })}
          >
            <View className='sc-case-card__head'>
              <View className='sc-avatar'>
                <Text>{item.name.slice(0, 1)}</Text>
              </View>
              <View className='sc-case-card__identity'>
                <Text className='sc-case-card__name'>{item.name}</Text>
                <Text className='sc-case-card__meta'>{item.age}岁 · {item.community}</Text>
              </View>
              <Text className={`sc-risk sc-risk--${item.risk}`}>{item.riskLabel}</Text>
            </View>
            <Text className='sc-case-card__summary'>{item.summary}</Text>
            <View className='sc-case-card__stats'>
              <View>
                <Text className='sc-stat-label'>最近情绪</Text>
                <Text className='sc-stat-value'>{item.lastEmotion}</Text>
              </View>
              <View>
                <Text className='sc-stat-label'>咨询次数</Text>
                <Text className='sc-stat-value'>{item.consultationCount}次</Text>
              </View>
              <View>
                <Text className='sc-stat-label'>最近咨询</Text>
                <Text className='sc-stat-value'>{item.lastConsultation}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <ServiceTabBar active='cases' />
    </View>
  );
}
