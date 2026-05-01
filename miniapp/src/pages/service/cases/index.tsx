import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Input, Text, View } from '@tarojs/components';
import { EmptyState } from '@/components/EmptyState';
import { ServiceTabBar } from '@/components/ServiceTabBar';
import { getServiceCases, type ServiceCase } from '@/services/service';

const tabs: Array<{ label: string; risk?: ServiceCase['risk'] }> = [
  { label: '全部' },
  { label: '高风险', risk: 'high' },
  { label: '中风险', risk: 'medium' },
  { label: '低风险', risk: 'low' },
];

function getRiskLabel(risk: ServiceCase['risk']) {
  if (risk === 'high') return '高风险';
  if (risk === 'medium') return '中风险';
  return '低风险';
}

function getCaseSummary(item: ServiceCase) {
  const parts = [
    `最近情绪：${item.lastEmotion || '暂无记录'}`,
    `未处理预警：${item.openAlertCount} 条`,
  ];
  if (item.familyContactName) {
    parts.push(`家属联系人：${item.familyContactName}`);
  }
  return parts.join(' · ');
}

export default function ServiceCasesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [cases, setCases] = useState<ServiceCase[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setCases(await getServiceCases());
    } catch (error) {
      const message = error instanceof Error ? error.message : '个案加载失败';
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

  const filteredCases = useMemo(() => {
    const value = keyword.trim();
    const selectedRisk = tabs[activeTab]?.risk;
    return cases.filter((item) => {
      const tabMatched = !selectedRisk || item.risk === selectedRisk;
      const keywordMatched =
        !value ||
        item.name.includes(value) ||
        item.phone?.includes(value) ||
        item.familyContactName?.includes(value) ||
        item.familyContactPhone?.includes(value);
      return tabMatched && keywordMatched;
    });
  }, [activeTab, cases, keyword]);

  return (
    <View className='service-page service-page--figma sc-page'>
      <View className='sc-header'>
        <Text className='sc-title'>个案管理</Text>
        <View className='sc-search-row'>
          <Input
            className='sc-search'
            value={keyword}
            placeholder='搜索老人姓名或联系电话'
            onInput={(event) => setKeyword(event.detail.value)}
          />
        </View>
      </View>

      <View className='sc-tabs'>
        {tabs.map((tab, index) => (
          <Text
            key={tab.label}
            className={`sc-tab ${activeTab === index ? 'sc-tab--active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {tab.label}
          </Text>
        ))}
      </View>

      <View className='sc-list'>
        {filteredCases.length ? (
          filteredCases.map((item) => (
            <View
              className='sc-case-card'
              key={item.elderlyId}
              onClick={() => Taro.navigateTo({ url: `/pages/service/case-detail/index?elderlyId=${item.elderlyId}` })}
            >
              <View className='sc-case-card__head'>
                <View className='sc-avatar'>
                  <Text>{item.name.slice(0, 1)}</Text>
                </View>
                <View className='sc-case-card__identity'>
                  <Text className='sc-case-card__name'>{item.name}</Text>
                  <Text className='sc-case-card__meta'>
                    {item.phone || '暂无电话'} · {item.familyContactPhone || '暂无家属电话'}
                  </Text>
                </View>
                <Text className={`sc-risk sc-risk--${item.risk}`}>{getRiskLabel(item.risk)}</Text>
              </View>
              <Text className='sc-case-card__summary'>{getCaseSummary(item)}</Text>
              <View className='sc-case-card__stats'>
                <View>
                  <Text className='sc-stat-label'>最近情绪</Text>
                  <Text className='sc-stat-value'>{item.lastEmotion}</Text>
                </View>
                <View>
                  <Text className='sc-stat-label'>预警</Text>
                  <Text className='sc-stat-value'>{item.openAlertCount}条</Text>
                </View>
                <View>
                  <Text className='sc-stat-label'>最近求助</Text>
                  <Text className='sc-stat-value'>{item.lastHelpAt || '暂无'}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <EmptyState title={loading ? '正在加载个案' : '暂无匹配个案'} hint='老人信息、预警和情绪记录会汇总为服务个案。' />
        )}
      </View>

      <ServiceTabBar active='cases' />
    </View>
  );
}
