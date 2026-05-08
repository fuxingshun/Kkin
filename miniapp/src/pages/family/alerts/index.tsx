import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';
import {
  alertTypeLabelMap,
  getAlertStats,
  getFamilyAlerts,
  handleAlert,
  markAlertAsRead,
  type FamilyAlert,
} from '@/services/family';
import { formatDateTimeText } from '@/utils/format';
import { useNavigationMetrics } from '@/utils/navigation';

type AlertTab = 'unread' | 'unhandled' | 'all';

function getTone(level?: FamilyAlert['level']) {
  if (level === 'high') return 'amber';
  if (level === 'medium') return 'blue';
  return 'green';
}

function getTag(alert: FamilyAlert) {
  if (alert.handled) return '已完成';
  if (!alert.read) return '未读';
  return '待处理';
}

function getAlertExtraText(alert: FamilyAlert) {
  const metadata = alert.metadata || {};
  if (alert.alert_type === 'contact_family') {
    const name = typeof metadata.contact_name === 'string' ? metadata.contact_name : '';
    const phone = typeof metadata.contact_phone === 'string' ? metadata.contact_phone : '';
    if (name && phone) return `联系人：${name} ${phone}`;
    if (name) return `联系人：${name}`;
  }
  if (alert.alert_type === 'sos_emergency') {
    const count = Number(metadata.recipient_count || 0);
    if (count > 0) return `已通知家属联系人：${count}人`;
  }
  return '';
}

export default function AlertsPage() {
  const navigation = useNavigationMetrics();
  const [activeTab, setActiveTab] = useState<AlertTab>('unread');
  const [alerts, setAlerts] = useState<FamilyAlert[]>([]);
  const [stats, setStats] = useState({
    unread: 0,
    unhandled: 0,
    handled: 0,
    today: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const [alertsResult, alertStats] = await Promise.all([
        getFamilyAlerts(undefined, { limit: 50 }),
        getAlertStats(),
      ]);

      setAlerts(alertsResult.alerts || []);
      setStats({
        unread: alertStats.status_stats?.unread || 0,
        unhandled: alertStats.status_stats?.unhandled || 0,
        handled: alertStats.status_stats?.handled || 0,
        today: alertStats.today_count || 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '通知加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      Taro.stopPullDownRefresh();
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  usePullDownRefresh(() => {
    void loadData();
  });

  const tabs = useMemo(
    () => [
      { key: 'unread' as const, label: `未读(${stats.unread})` },
      { key: 'unhandled' as const, label: `未处理(${stats.unhandled})` },
      { key: 'all' as const, label: '全部' },
    ],
    [stats.unhandled, stats.unread]
  );

  const visibleAlerts = useMemo(() => {
    if (activeTab === 'unread') return alerts.filter((item) => !item.read);
    if (activeTab === 'unhandled') return alerts.filter((item) => !item.handled);
    return alerts;
  }, [activeTab, alerts]);

  async function markRead(item: FamilyAlert) {
    if (item.read) return;
    try {
      await markAlertAsRead(item.id);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '标记已读失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  async function resolveAlert(item: FamilyAlert) {
    try {
      if (!item.read) {
        await markAlertAsRead(item.id);
      }
      await handleAlert(item.id, {
        reply_message: '家属端已查看并完成处理',
      });
      Taro.showToast({ title: '已处理', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '处理失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-topbar ff-topbar--sticky' style={navigation.topbarStyle}>
        <View>
          <Text className='ff-topbar__title'>通知中心</Text>
          <Text className='ff-topbar__desc'>需要家属出手的事项会放在这里</Text>
        </View>
      </View>

      <View className='ff-tab-strip ff-tab-strip--top'>
        {tabs.map((tab) => (
          <Text
            key={tab.key}
            className={`ff-tab ${activeTab === tab.key ? 'ff-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Text>
        ))}
      </View>

      <View className='ff-stat-row'>
        <View className='ff-stat-pill'><Text>{stats.unread}</Text><Text>未读</Text></View>
        <View className='ff-stat-pill'><Text>{stats.unhandled}</Text><Text>未处理</Text></View>
        <View className='ff-stat-pill'><Text>{stats.today}</Text><Text>今日通知</Text></View>
      </View>

      <View className='ff-stack ff-stack--page'>
        {visibleAlerts.length ? (
          visibleAlerts.map((item) => {
            const tone = getTone(item.level);
            const extraText = getAlertExtraText(item);
            return (
              <View className='ff-notice-card' key={item.id}>
                <View className={`ff-notice-card__icon ff-notice-card__icon--${tone}`}>
                  <Text>{item.elderly_name?.slice(0, 1) || '提'}</Text>
                </View>
                <View className='ff-notice-card__body'>
                  <View className='ff-section-head ff-section-head--tight'>
                    <Text className='ff-card-title'>{item.title || alertTypeLabelMap[item.alert_type] || '家庭通知'}</Text>
                    <Text className='ff-card-meta'>{formatDateTimeText(item.created_at)}</Text>
                  </View>
                  <Text className='ff-card-text'>{item.message}</Text>
                  {extraText ? <Text className='ff-card-text'>{extraText}</Text> : null}
                  <View className='ff-soft-button-row'>
                    <Text className={`ff-chip ff-chip--${tone}`}>{getTag(item)}</Text>
                    {!item.read ? (
                      <Text className='ff-soft-button ff-soft-button--plain' onClick={() => void markRead(item)}>
                        标记已读
                      </Text>
                    ) : null}
                    {!item.handled ? (
                      <Text className='ff-soft-button' onClick={() => void resolveAlert(item)}>
                        立即处理
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View className='ff-notice-card'>
            <View className='ff-notice-card__body'>
              <Text className='ff-card-title'>暂无通知</Text>
              <Text className='ff-card-text'>老人端新的求助、提醒或异常会实时同步到这里。</Text>
            </View>
          </View>
        )}
      </View>

      <BottomNav active='alerts' />
    </View>
  );
}
