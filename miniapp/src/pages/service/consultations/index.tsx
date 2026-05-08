import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { EmptyState } from '@/components/EmptyState';
import { ServiceTabBar } from '@/components/ServiceTabBar';
import {
  advanceFollowupStatus,
  createServiceRecord,
  getServiceFollowups,
  type ServiceFollowup,
} from '@/services/service';
import { formatDateTimeText } from '@/utils/format';

const tabs: Array<{ label: string; status?: ServiceFollowup['status'] }> = [
  { label: '全部' },
  { label: '待进行', status: 'scheduled' },
  { label: '进行中', status: 'in_progress' },
  { label: '已完成', status: 'completed' },
];

function getStatusLabel(status: ServiceFollowup['status']) {
  if (status === 'scheduled') return '待进行';
  if (status === 'in_progress') return '进行中';
  if (status === 'completed') return '已完成';
  if (status === 'cancelled') return '已取消';
  return status;
}

function getConsultationStatusLabel(item: ServiceFollowup) {
  return item.statusLabel || getStatusLabel(item.status);
}

function getConsultationActionLabel(item: ServiceFollowup) {
  return item.nextAction || (item.status === 'scheduled' ? '进入咨询' : item.status === 'in_progress' ? '完成咨询' : '查看详情');
}

export default function ServiceConsultationsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [consultations, setConsultations] = useState<ServiceFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setConsultations(await getServiceFollowups(undefined, 50));
    } catch (error) {
      const message = error instanceof Error ? error.message : '咨询记录加载失败';
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

  const filteredList = useMemo(() => {
    const value = keyword.trim();
    const selectedStatus = tabs[activeTab]?.status;
    return consultations.filter((item) => {
      const tabMatched = !selectedStatus || item.status === selectedStatus;
      const keywordMatched = !value || item.elderlyName.includes(value) || item.note?.includes(value);
      return tabMatched && keywordMatched;
    });
  }, [activeTab, consultations, keyword]);

  async function progressConsultation(item: ServiceFollowup) {
    if (item.status === 'completed') {
      if (item.elderlyId) {
        Taro.navigateTo({ url: `/pages/service/case-detail/index?elderlyId=${item.elderlyId}` });
      }
      return;
    }

    try {
      setBusyId(item.id);
      if (item.status === 'in_progress' && item.elderlyId) {
        type EditableModalResult = Awaited<ReturnType<typeof Taro.showModal>> & { content?: string };
        type EditableModalOptions = Parameters<typeof Taro.showModal>[0] & {
          editable: boolean;
          placeholderText: string;
        };

        const result = (await Taro.showModal({
          title: '完成咨询',
          editable: true,
          placeholderText: '填写本次咨询结论、风险判断或后续建议',
        } as EditableModalOptions)) as EditableModalResult;
        const content = typeof result.content === 'string' ? result.content.trim() : '';

        if (!result.confirm || !content) {
          return;
        }

        await createServiceRecord({
          elderlyId: item.elderlyId,
          content: `心理咨询记录：${content}`,
        });
      }
      await advanceFollowupStatus(item);
      Taro.showToast({ title: item.status === 'scheduled' ? '已开始' : '已完成', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '咨询状态更新失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setBusyId(null);
    }
  }

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
          <Text className='sc-filter' onClick={() => Taro.redirectTo({ url: '/pages/service/followup/index' })}>随访</Text>
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
        {filteredList.length ? (
          filteredList.map((item) => (
            <View className='sc-consult-card' key={item.id}>
              <View className='sc-consult-card__head'>
                <View className='sc-consult-icon'>
                  <Text>{item.consultationType.includes('视频') ? '视' : '电'}</Text>
                </View>
                <View className='sc-consult-card__identity'>
                  <Text className='sc-consult-card__name'>{item.elderlyName}</Text>
                  <Text className='sc-consult-card__meta'>{formatDateTimeText(item.scheduledTime)}</Text>
                </View>
                <Text className={`sc-status sc-status--${item.status}`}>{getConsultationStatusLabel(item)}</Text>
              </View>
              <View className='sc-topic-box'>
                <Text className='sc-topic-box__label'>咨询类型</Text>
                <Text className='sc-topic-box__text'>{item.consultationType}</Text>
              </View>
              {item.familyVisibleSummary || item.note ? (
                <View className='sc-note-box'>
                  <Text>{item.familyVisibleSummary || item.note}</Text>
                </View>
              ) : null}
              <View className='sc-consult-card__foot'>
                <Text className='sc-consult-type'>{getConsultationStatusLabel(item)}</Text>
                <View className='sc-action-row'>
                  <Button
                    className='sc-action sc-action--ghost'
                    onClick={() => Taro.redirectTo({ url: '/pages/service/schedule/index' })}
                  >
                    日程
                  </Button>
                  <Button
                    className='sc-action sc-action--primary'
                    loading={busyId === item.id}
                    onClick={() => void progressConsultation(item)}
                  >
                    {getConsultationActionLabel(item)}
                  </Button>
                </View>
              </View>
            </View>
          ))
        ) : (
          <EmptyState title={loading ? '正在加载咨询' : '暂无咨询记录'} hint='家属端和服务端创建的咨询会同步到这里。' />
        )}
      </View>

      <View className='sc-month-card'>
        <Text className='sc-month-card__title'>咨询统计</Text>
        <View className='sc-month-grid'>
          <View>
            <Text className='sc-month-value'>{consultations.length}</Text>
            <Text className='sc-month-label'>咨询总数</Text>
          </View>
          <View>
            <Text className='sc-month-value'>{consultations.filter((item) => item.status !== 'completed').length}</Text>
            <Text className='sc-month-label'>待跟进</Text>
          </View>
          <View>
            <Text className='sc-month-value'>{consultations.filter((item) => item.status === 'completed').length}</Text>
            <Text className='sc-month-label'>已完成</Text>
          </View>
        </View>
      </View>

      <ServiceTabBar active='consultations' />
    </View>
  );
}
