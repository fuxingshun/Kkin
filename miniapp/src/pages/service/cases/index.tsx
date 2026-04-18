import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Input, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';
import { getServiceCases, type ServiceCase } from '@/services/service';

const tabs = ['全部', '高风险', '中风险', '低风险'];

function getRiskLabel(risk: ServiceCase['risk']) {
  if (risk === 'high') return '高风险';
  if (risk === 'medium') return '中风险';
  return '低风险';
}

function getRiskTone(risk: ServiceCase['risk']) {
  if (risk === 'high') return 'service-chip--red';
  if (risk === 'medium') return 'service-chip--amber';
  return 'service-chip--green';
}

export default function ServiceCasesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [cases, setCases] = useState<ServiceCase[]>([]);

  const loadData = useCallback(async () => {
    try {
      const result = await getServiceCases();
      setCases(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '个案加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  const filteredList = useMemo(() => {
    return cases.filter((item) => {
      const riskMatched = activeTab === 0 || getRiskLabel(item.risk) === tabs[activeTab];
      const keywordValue = keyword.trim();
      const keywordMatched = !keywordValue || item.name.includes(keywordValue) || (item.familyContactName || '').includes(keywordValue);
      return riskMatched && keywordMatched;
    });
  }, [activeTab, cases, keyword]);

  return (
    <View className='service-page'>
      <View className='service-topbar'>
        <Text className='service-topbar__title'>重点老人列表</Text>
        <Input
          className='service-search'
          value={keyword}
          placeholder='搜索老人姓名或家属'
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
        {filteredList.length ? (
          filteredList.map((item) => (
            <View
              className='service-case-card'
              key={item.elderlyId}
              onClick={() => Taro.navigateTo({ url: `/pages/service/case-detail/index?elderlyId=${item.elderlyId}&alertId=${item.latestAlertId || ''}` })}
            >
              <View className='service-case-card__head'>
                <View className='service-case-row__avatar'>
                  <Text>{item.name.slice(0, 1)}</Text>
                </View>
                <View className='service-case-row__body'>
                  <Text className='service-card-title'>{item.name}</Text>
                  <Text className='service-card-meta'>家属联系人：{item.familyContactName || '未绑定'}</Text>
                </View>
                <Text className={`service-chip ${getRiskTone(item.risk)}`}>
                  {getRiskLabel(item.risk)}
                </Text>
              </View>
              <View className='service-case-card__metrics'>
                <View>
                  <Text className='service-card-meta'>最近情绪</Text>
                  <Text className='service-card-title'>{item.lastEmotion}</Text>
                </View>
                <View>
                  <Text className='service-card-meta'>待处理告警</Text>
                  <Text className='service-card-title'>{item.openAlertCount} 条</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View className='service-case-card'>
            <Text className='service-card-title'>暂无匹配个案</Text>
            <Text className='service-card-meta'>当前筛选条件下没有待跟进的老人。</Text>
          </View>
        )}
      </View>

      <ServiceTabBar active='cases' />
    </View>
  );
}
