import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { EmptyState } from '@/components/EmptyState';
import { ServiceTabBar } from '@/components/ServiceTabBar';
import {
  createQuickFollowup,
  getServiceCases,
  getServiceFollowups,
  type ServiceCase,
  type ServiceFollowup,
} from '@/services/service';
import { formatDateTimeText, formatDateValue, pad } from '@/utils/format';

const slotTimes = ['08:30', '09:00', '10:00', '11:00', '14:00', '14:30', '15:00', '16:00', '17:00', '19:00'];
const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDate(value: string, date: Date) {
  const target = new Date(value);
  return (
    !Number.isNaN(target.getTime()) &&
    target.getFullYear() === date.getFullYear() &&
    target.getMonth() === date.getMonth() &&
    target.getDate() === date.getDate()
  );
}

function toDateTimeValue(date: Date, time: string) {
  return `${formatDateValue(date)} ${time}:00`;
}

export default function ServiceSchedulePage() {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay());
  const [followups, setFollowups] = useState<ServiceFollowup[]>([]);
  const [cases, setCases] = useState<ServiceCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSlot, setCreatingSlot] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nextFollowups, nextCases] = await Promise.all([
        getServiceFollowups(undefined, 100),
        getServiceCases(),
      ]);
      setFollowups(nextFollowups);
      setCases(nextCases);
    } catch (error) {
      const message = error instanceof Error ? error.message : '日程加载失败';
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

  const weekDays = useMemo(() => {
    const base = startOfDay();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(base);
      date.setDate(base.getDate() + index);
      return {
        date,
        day: dayNames[date.getDay()],
        label: `${date.getMonth() + 1}/${date.getDate()}`,
      };
    });
  }, []);

  const selectedSchedules = useMemo(
    () => followups.filter((item) => isSameDate(item.scheduledTime, selectedDate)),
    [followups, selectedDate]
  );

  const selectedDateText = `${selectedDate.getFullYear()}年${pad(selectedDate.getMonth() + 1)}月${pad(selectedDate.getDate())}日`;

  async function createScheduleAt(time?: string) {
    const candidates = cases.filter((item) => item.risk !== 'low' || item.openAlertCount > 0).slice(0, 6);
    if (!candidates.length) {
      Taro.showToast({ title: '暂无可安排的个案', icon: 'none' });
      return;
    }

    const result = await Taro.showActionSheet({
      itemList: candidates.map((item) => `${item.name} · ${item.openAlertCount}条预警`),
    });
    const selectedCase = candidates[result.tapIndex];
    if (!selectedCase) {
      return;
    }

    const slot = time || slotTimes.find((item) => !selectedSchedules.some((followup) => followup.scheduledTime.includes(item)));
    if (!slot) {
      Taro.showToast({ title: '当天暂无空闲时段', icon: 'none' });
      return;
    }

    try {
      setCreatingSlot(slot);
      await createQuickFollowup(
        selectedCase.elderlyId,
        undefined,
        'phone',
        `服务端日程安排：${toDateTimeValue(selectedDate, slot)} 电话随访`
      );
      Taro.showToast({ title: '日程已创建', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建日程失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setCreatingSlot('');
    }
  }

  return (
    <View className='service-page service-page--figma ss-page'>
      <View className='ss-header'>
        <Text className='ss-title'>咨询日程</Text>
        <View className='ss-week-nav'>
          <Text onClick={() => setSelectedDate(startOfDay())}>今天</Text>
          <Text>{selectedDateText}</Text>
          <Text onClick={() => Taro.redirectTo({ url: '/pages/service/followup/index' })}>随访</Text>
        </View>
      </View>

      <View className='ss-week-strip'>
        {weekDays.map((item) => (
          <View
            className={`ss-day ${isSameDate(item.date.toISOString(), selectedDate) ? 'ss-day--active' : ''}`}
            key={item.label}
            onClick={() => setSelectedDate(item.date)}
          >
            <Text className='ss-day__name'>{item.day}</Text>
            <Text className='ss-day__date'>{item.label}</Text>
          </View>
        ))}
      </View>

      <Button className='ss-add-btn' loading={Boolean(creatingSlot)} onClick={() => void createScheduleAt()}>
        添加咨询安排
      </Button>

      <View className='ss-card'>
        <Text className='ss-card__title'>当日安排</Text>
        <View className='ss-timeline'>
          {selectedSchedules.length ? (
            selectedSchedules.map((item) => (
              <View className='ss-timeline-item' key={item.id}>
                <View className='ss-time'>
                  <Text>{formatDateTimeText(item.scheduledTime).slice(-5)}</Text>
                </View>
                <View className='ss-schedule-card'>
                  <View className='ss-schedule-card__head'>
                    <View>
                      <Text className='ss-schedule-card__name'>{item.elderlyName}</Text>
                      <Text className='ss-schedule-card__topic'>{item.note || '服务随访'}</Text>
                    </View>
                    <Text className='ss-duration'>{item.status}</Text>
                  </View>
                  <View className='ss-schedule-card__foot'>
                    <Text className='ss-consult-type'>{item.consultationType}</Text>
                    <Text
                      className='ss-enter'
                      onClick={() => item.elderlyId && Taro.navigateTo({ url: `/pages/service/case-detail/index?elderlyId=${item.elderlyId}` })}
                    >
                      查看个案
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <EmptyState title={loading ? '正在加载日程' : '当日暂无安排'} hint='选择可预约时间，为高风险个案快速创建随访。' />
          )}
        </View>
      </View>

      <View className='ss-card'>
        <Text className='ss-card__title'>可预约时间</Text>
        <View className='ss-slot-grid'>
          {slotTimes.map((time) => {
            const disabled = selectedSchedules.some((item) => item.scheduledTime.includes(time));
            return (
              <Button
                className={`ss-slot ${disabled ? 'ss-slot--disabled' : ''}`}
                disabled={disabled}
                loading={creatingSlot === time}
                key={time}
                onClick={() => void createScheduleAt(time)}
              >
                {time}
              </Button>
            );
          })}
        </View>
      </View>

      <View className='ss-stats-card'>
        <View>
          <Text className='ss-stat-value'>{followups.length}</Text>
          <Text className='ss-stat-label'>全部咨询</Text>
        </View>
        <View>
          <Text className='ss-stat-value'>{followups.filter((item) => item.status === 'completed').length}</Text>
          <Text className='ss-stat-label'>已完成</Text>
        </View>
        <View>
          <Text className='ss-stat-value'>{followups.filter((item) => item.status !== 'completed').length}</Text>
          <Text className='ss-stat-label'>待进行</Text>
        </View>
      </View>

      <ServiceTabBar active='schedule' />
    </View>
  );
}
