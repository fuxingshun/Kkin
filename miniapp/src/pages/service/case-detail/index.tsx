import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';
import {
  completeServiceTask,
  createServiceRecord,
  getServiceCaseDetail,
} from '@/services/service';
import { formatDateTimeText } from '@/utils/format';

function parseId(value?: string) {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? result : null;
}

export default function ServiceCaseDetailPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const elderlyId = parseId(params.elderlyId);
  const alertId = parseId(params.alertId);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getServiceCaseDetail>> | null>(null);

  const loadData = useCallback(async () => {
    if (!elderlyId) {
      return;
    }

    try {
      const result = await getServiceCaseDetail(undefined, elderlyId);
      setDetail(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '个案详情加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, [elderlyId]);

  useDidShow(() => {
    void loadData();
  });

  const caseInfo = detail?.caseInfo;
  const insight = detail?.insight;
  const familyContact = detail?.familyContacts?.[0];
  const latestMood = detail?.moodRecords?.[0];

  const warningText = useMemo(() => {
    if (insight?.reason) {
      return insight.reason;
    }

    if (!caseInfo) {
      return '请先从重点老人列表进入具体个案。';
    }

    if (caseInfo.risk === 'high') {
      return `当前仍有 ${caseInfo.openAlertCount} 条待处理告警，建议优先跟进。`;
    }

    if (latestMood?.mood_score && latestMood.mood_score <= 6) {
      return '最近情绪评分偏低，建议安排一次主动随访。';
    }

    return '当前状态相对稳定，建议保持例行跟进节奏。';
  }, [caseInfo, insight?.reason, latestMood?.mood_score]);

  async function handleCreateRecord() {
    if (!elderlyId) {
      return;
    }

    type EditableModalResult = Awaited<ReturnType<typeof Taro.showModal>> & { content?: string };
    type EditableModalOptions = Parameters<typeof Taro.showModal>[0] & {
      editable: boolean;
      placeholderText: string;
    };

    const result = (await Taro.showModal({
      title: '创建服务记录',
      editable: true,
      placeholderText: '输入本次处理或随访摘要',
    } as EditableModalOptions)) as EditableModalResult;
    const content = typeof result.content === 'string' ? result.content.trim() : '';

    if (!result.confirm || !content) {
      return;
    }

    try {
      await createServiceRecord({
        elderlyId,
        alertId: alertId || undefined,
        content,
      });
      if (alertId) {
        await completeServiceTask(alertId, content);
      }
      Taro.showToast({ title: '服务记录已保存', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存服务记录失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  async function handleCallFamily() {
    if (!familyContact?.phone) {
      Taro.showToast({ title: '暂无家属联系电话', icon: 'none' });
      return;
    }

    try {
      await Taro.makePhoneCall({ phoneNumber: familyContact.phone });
    } catch (error) {
      const message = error instanceof Error ? error.message : '拨号失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  return (
    <View className='service-page'>
      <View className='service-topbar service-topbar--inline'>
        <Text className='service-link' onClick={() => Taro.redirectTo({ url: '/pages/service/cases/index' })}>
          返回
        </Text>
        <Text className='service-topbar__title'>个案详情</Text>
        <Text className='service-link' onClick={() => Taro.redirectTo({ url: '/pages/service/followup/index' })}>随访</Text>
      </View>

      <View className='service-section'>
        <View className='service-profile-card'>
          <View className='service-profile-card__avatar'>
            <Text>{caseInfo?.name?.slice(0, 1) || '案'}</Text>
          </View>
          <View className='service-profile-card__body'>
            <View className='service-chip-row'>
              <Text className='service-card-title'>{caseInfo?.name || '未找到个案'}</Text>
              {caseInfo ? (
                <Text className={`service-chip ${caseInfo.risk === 'high' ? 'service-chip--red' : caseInfo.risk === 'medium' ? 'service-chip--amber' : 'service-chip--green'}`}>
                  {caseInfo.risk === 'high' ? '高风险' : caseInfo.risk === 'medium' ? '中风险' : '低风险'}
                </Text>
              ) : null}
            </View>
            <Text className='service-card-meta'>待处理告警：{caseInfo?.openAlertCount || 0} 条</Text>
          </View>
        </View>
        <View className='service-two-grid'>
          <View className='service-info-box'>
            <Text className='service-card-meta'>家属联系人</Text>
            <Text className='service-card-title'>{familyContact?.name || '未绑定'}</Text>
          </View>
          <View className='service-info-box'>
            <Text className='service-card-meta'>联系电话</Text>
            <Text className='service-card-title'>{familyContact?.phone || '暂无号码'}</Text>
          </View>
        </View>
      </View>

      <View className={`service-section service-insight service-insight--${insight?.risk_level || caseInfo?.risk || 'low'}`}>
        <View className='service-follow-card'>
          <View className='service-follow-card__head'>
            <Text className='service-card-title'>处理 SOP · {insight?.status_label || '待同步'}</Text>
            <Text className='service-chip'>{insight?.metrics?.completion_rate ?? 0}% 完成</Text>
          </View>
          <Text className='service-card-text'>{insight?.reason || warningText}</Text>
          <Text className='service-card-meta'>下一步：{insight?.next_step || '先核实预警，再记录处理结果。'}</Text>
          <View className='service-sop-list'>
            {(insight?.service_sop?.length ? insight.service_sop : ['确认老人安全状态', '联系家属同步处理进展', '补充服务记录并安排随访']).map((item, index) => (
              <Text className='service-sop-item' key={`${index}-${item}`}>
                {index + 1}. {item}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>最近 7 次情绪趋势</Text>
        <View className='service-chart'>
          {(detail?.moodTrend?.length ? detail.moodTrend : [{ day: '--', score: 0 }]).map((item) => (
            <View className='service-chart__item' key={`${item.day}-${item.score}`}>
              <View className='service-chart__track'>
                <View className='service-chart__bar' style={{ height: `${Math.max(item.score, 8)}%` }} />
              </View>
              <Text className='service-chart__label'>{item.day}</Text>
            </View>
          ))}
        </View>
        <View className='service-warning'>
          <Text>{warningText}</Text>
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>最近工单</Text>
        <View className='service-list'>
          {detail?.alerts?.length ? (
            detail.alerts.slice(0, 3).map((item) => (
              <View className='service-follow-card' key={item.id}>
                <View className='service-follow-card__head'>
                  <Text className='service-card-title'>{item.title || item.alert_type}</Text>
                  <Text className='service-chip'>{item.handled ? '已完成' : item.read ? '处理中' : '待处理'}</Text>
                </View>
                <Text className='service-card-text'>{item.message}</Text>
                <Text className='service-card-meta'>{formatDateTimeText(item.created_at)}</Text>
              </View>
            ))
          ) : (
            <View className='service-follow-card'>
              <Text className='service-card-title'>暂无历史工单</Text>
              <Text className='service-card-meta'>新的异常和求助会在这里沉淀。</Text>
            </View>
          )}
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>服务记录</Text>
        <View className='service-list'>
          {detail?.consultations?.length ? (
            detail.consultations.slice(0, 3).map((item) => (
              <View className='service-follow-card' key={item.id}>
                <View className='service-follow-card__head'>
                  <Text className='service-card-title'>{item.consultation_type === 'text' ? '服务记录' : '随访记录'}</Text>
                  <Text className='service-chip'>{item.status}</Text>
                </View>
                <Text className='service-card-text'>{item.note || '未填写摘要'}</Text>
                <Text className='service-card-meta'>{formatDateTimeText(item.scheduled_time)}</Text>
              </View>
            ))
          ) : (
            <View className='service-follow-card'>
              <Text className='service-card-title'>暂无服务记录</Text>
              <Text className='service-card-meta'>点击下方按钮即可新增一次服务记录。</Text>
            </View>
          )}
        </View>
      </View>

      <View className='service-two-grid'>
        <Button className='service-button service-button--primary' onClick={() => void handleCreateRecord()}>
          创建服务记录
        </Button>
        <Button className='service-button service-button--soft' onClick={() => void handleCallFamily()}>
          联系家属
        </Button>
      </View>

      <ServiceTabBar active='cases' />
    </View>
  );
}
