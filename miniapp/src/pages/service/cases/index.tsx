import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Input, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const caseList = [
  { id: 1, name: '张翠花', age: 68, risk: '高', community: '阳光社区', lastEmotion: '难过', lastHelp: '3 天前' },
  { id: 2, name: '李秀英', age: 72, risk: '中', community: '和谐社区', lastEmotion: '焦虑', lastHelp: '5 天前' },
  { id: 3, name: '王大爷', age: 75, risk: '低', community: '阳光社区', lastEmotion: '平稳', lastHelp: '12 天前' },
];

const tabs = ['全部', '高风险', '中风险', '低风险'];

export default function ServiceCasesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [keyword, setKeyword] = useState('');

  const filteredList = caseList.filter((item) => {
    const riskMatched = activeTab === 0 || `${item.risk}风险` === tabs[activeTab];
    const keywordMatched = !keyword.trim() || item.name.includes(keyword.trim()) || item.community.includes(keyword.trim());
    return riskMatched && keywordMatched;
  });

  return (
    <View className='service-page'>
      <View className='service-topbar'>
        <Text className='service-topbar__title'>重点老人列表</Text>
        <Input
          className='service-search'
          value={keyword}
          placeholder='搜索老人姓名或社区'
          onInput={(e) => setKeyword(e.detail.value)}
        />
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
        {filteredList.map((item) => (
          <View className='service-case-card' key={item.id} onClick={() => Taro.navigateTo({ url: `/pages/service/case-detail/index?id=${item.id}` })}>
            <View className='service-case-card__head'>
              <View className='service-case-row__avatar'>
                <Text>{item.name.slice(0, 1)}</Text>
              </View>
              <View className='service-case-row__body'>
                <Text className='service-card-title'>{item.name} · {item.age} 岁</Text>
                <Text className='service-card-meta'>{item.community}</Text>
              </View>
              <Text className={`service-chip ${item.risk === '高' ? 'service-chip--red' : item.risk === '中' ? 'service-chip--amber' : 'service-chip--green'}`}>
                {item.risk}风险
              </Text>
            </View>
            <View className='service-case-card__metrics'>
              <View>
                <Text className='service-card-meta'>最近情绪</Text>
                <Text className='service-card-title'>{item.lastEmotion}</Text>
              </View>
              <View>
                <Text className='service-card-meta'>最近求助</Text>
                <Text className='service-card-title'>{item.lastHelp}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <ServiceTabBar active='cases' />
    </View>
  );
}
