import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';
import {
  createSchedule,
  deleteSchedule,
  getFamilySchedules,
  repeatTypeOptions,
  scheduleTypeOptions,
  updateSchedule,
  type Schedule,
} from '@/services/family';
import { combineDateTime, formatDateTimeText, formatDateValue, formatTimeValue } from '@/utils/format';
import { getFamilySession, requireCurrentFamilyId } from '@/utils/familySession';
import { useNavigationMetrics } from '@/utils/navigation';

const filters = [
  { key: 'all', label: '全部' },
  ...scheduleTypeOptions.map((item) => ({ key: item.value, label: item.label })),
] as const;

type FilterKey = (typeof filters)[number]['key'];

function createDefaultScheduleTime() {
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return {
    dateValue: formatDateValue(next),
    timeValue: formatTimeValue(next),
  };
}

function isSameDay(value?: string, now = new Date()) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getStatusLabel(status?: Schedule['status']) {
  switch (status) {
    case 'completed':
      return { label: '今日已完成', tone: 'green' };
    case 'skipped':
      return { label: '已跳过', tone: 'amber' };
    case 'missed':
      return { label: '已错过', tone: 'pink' };
    default:
      return { label: '待执行', tone: 'blue' };
  }
}

function sortSchedules(list: Schedule[]) {
  return list
    .slice()
    .sort((a, b) => new Date(a.schedule_time).getTime() - new Date(b.schedule_time).getTime());
}

export default function CarePage() {
  const navigation = useNavigationMetrics();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [typeIndex, setTypeIndex] = useState(0);
  const [repeatIndex, setRepeatIndex] = useState(0);
  const [dateValue, setDateValue] = useState(createDefaultScheduleTime().dateValue);
  const [timeValue, setTimeValue] = useState(createDefaultScheduleTime().timeValue);
  const familySession = useMemo(() => getFamilySession(), []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const nextSchedules = await getFamilySchedules();
      setSchedules(nextSchedules);
    } catch (error) {
      const message = error instanceof Error ? error.message : '护理计划加载失败';
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

  const todaySchedules = useMemo(() => schedules.filter((item) => isSameDay(item.schedule_time)), [schedules]);
  const completedToday = todaySchedules.filter((item) => item.status === 'completed').length;
  const completionRate = todaySchedules.length ? Math.round((completedToday / todaySchedules.length) * 100) : 0;
  const visibleSchedules = useMemo(() => {
    const filtered =
      activeFilter === 'all'
        ? schedules
        : schedules.filter((item) => (item.schedule_type || 'other') === activeFilter);
    return sortSchedules(filtered);
  }, [schedules, activeFilter]);

  async function handleCreate() {
    if (!title.trim()) {
      Taro.showToast({ title: '请先填写计划标题', icon: 'none' });
      return;
    }

    try {
      setSaving(true);
      const familyId = requireCurrentFamilyId(familySession);
      await createSchedule({
        family_id: familyId,
        title: title.trim(),
        description: description.trim(),
        schedule_type: scheduleTypeOptions[typeIndex]?.value || 'other',
        schedule_time: combineDateTime(dateValue, timeValue),
        repeat_type: repeatTypeOptions[repeatIndex]?.value || 'once',
      });
      Taro.showToast({ title: '护理计划已创建', icon: 'success' });
      setTitle('');
      setDescription('');
      setTypeIndex(0);
      setRepeatIndex(0);
      const next = createDefaultScheduleTime();
      setDateValue(next.dateValue);
      setTimeValue(next.timeValue);
      setComposerOpen(false);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建计划失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(item: Schedule, status: NonNullable<Schedule['status']>) {
    if (!item.id) {
      return;
    }

    try {
      await updateSchedule(item.id, { status });
      Taro.showToast({ title: '状态已更新', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新状态失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  async function handleDelete(item: Schedule) {
    if (!item.id) {
      return;
    }

    const result = await Taro.showModal({
      title: '删除护理计划',
      content: '确认删除这条计划吗？删除后老人端将不再收到对应提醒。',
    });

    if (!result.confirm) {
      return;
    }

    try {
      await deleteSchedule(item.id);
      Taro.showToast({ title: '已删除', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除计划失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-hero ff-hero--green' style={navigation.heroStyle}>
        <View className='ff-hero__top'>
          <View>
            <Text className='ff-kicker'>护理计划</Text>
            <Text className='ff-hero__title'>把照护拆成清楚的任务和提醒</Text>
          </View>
          <View className='ff-avatar ff-avatar--glass'>
            <Text>护</Text>
          </View>
        </View>
        <View className='ff-stat-grid'>
          <View className='ff-hero-stat'>
            <Text>{schedules.length}</Text>
            <Text>总计划数</Text>
          </View>
          <View className='ff-hero-stat'>
            <Text>{todaySchedules.length}</Text>
            <Text>今日任务</Text>
          </View>
          <View className='ff-hero-stat'>
            <Text>{completionRate}%</Text>
            <Text>完成率</Text>
          </View>
        </View>
      </View>

      <View className='ff-stack ff-stack--overlap'>
        <View className='ff-tab-strip ff-tab-strip--card'>
          {filters.map((item) => (
            <Text
              key={item.key}
              className={`ff-tab ${item.key === activeFilter ? 'ff-tab--green' : ''}`}
              onClick={() => setActiveFilter(item.key)}
            >
              {item.label}
            </Text>
          ))}
        </View>

        <View className='ff-card'>
          <View className='ff-section-head'>
            <View>
              <Text className='ff-section-title'>今日护理计划</Text>
              <Text className='ff-card-subtitle'>{todaySchedules.length} 个任务，{completedToday} 个已完成</Text>
            </View>
            <Text className='ff-green-link' onClick={() => setComposerOpen((prev) => !prev)}>
              {composerOpen ? '收起' : '新建'}
            </Text>
          </View>
          <View className='ff-progress-track ff-progress-track--green'>
            <View className='ff-progress-fill ff-progress-fill--green' style={{ width: `${completionRate}%` }} />
          </View>
        </View>

        {composerOpen ? (
          <View className='ff-card'>
            <View className='ke-form'>
              <View>
                <Text className='ke-label'>计划标题</Text>
                <Input
                  className='ke-input'
                  value={title}
                  placeholder='例如：早餐后服药'
                  onInput={(event) => setTitle(event.detail.value)}
                />
              </View>
              <View>
                <Text className='ke-label'>计划类型</Text>
                <Picker
                  mode='selector'
                  range={scheduleTypeOptions.map((item) => item.label)}
                  value={typeIndex}
                  onChange={(event) => setTypeIndex(Number(event.detail.value))}
                >
                  <View className='ke-input'>{scheduleTypeOptions[typeIndex]?.label || '请选择'}</View>
                </Picker>
              </View>
              <View>
                <Text className='ke-label'>执行日期</Text>
                <Picker mode='date' value={dateValue} onChange={(event) => setDateValue(event.detail.value)}>
                  <View className='ke-input'>{dateValue}</View>
                </Picker>
              </View>
              <View>
                <Text className='ke-label'>执行时间</Text>
                <Picker mode='time' value={timeValue} onChange={(event) => setTimeValue(event.detail.value)}>
                  <View className='ke-input'>{timeValue}</View>
                </Picker>
              </View>
              <View>
                <Text className='ke-label'>重复方式</Text>
                <Picker
                  mode='selector'
                  range={repeatTypeOptions.map((item) => item.label)}
                  value={repeatIndex}
                  onChange={(event) => setRepeatIndex(Number(event.detail.value))}
                >
                  <View className='ke-input'>{repeatTypeOptions[repeatIndex]?.label || '单次'}</View>
                </Picker>
              </View>
              <View>
                <Text className='ke-label'>说明</Text>
                <Textarea
                  className='ke-textarea'
                  maxlength={160}
                  value={description}
                  placeholder='例如：50mg，随餐服用；或饭后散步 20 分钟。'
                  onInput={(event) => setDescription(event.detail.value)}
                />
              </View>
              <View className='ff-form-actions'>
                <Button className='ff-form-button ff-form-button--ghost' onClick={() => setComposerOpen(false)}>
                  取消
                </Button>
                <Button className='ff-form-button ff-form-button--success' loading={saving} onClick={() => void handleCreate()}>
                  确认保存
                </Button>
              </View>
            </View>
          </View>
        ) : null}

        {visibleSchedules.length ? (
          visibleSchedules.map((item) => {
            const status = getStatusLabel(item.status);

            return (
              <View className='ff-care-card' key={`${item.id || item.title}-${item.schedule_time}`}>
                <View className={`ff-care-card__icon ff-care-card__icon--${status.tone}`}>
                  <Text>{scheduleTypeOptions.find((option) => option.value === item.schedule_type)?.label?.slice(0, 1) || '计'}</Text>
                </View>
                <View className='ff-care-card__body'>
                  <View className='ff-section-head ff-section-head--tight'>
                    <Text className='ff-card-title'>{item.title}</Text>
                    <Text className={`ff-chip ff-chip--${status.tone}`}>{status.label}</Text>
                  </View>
                  <Text className='ff-card-meta'>{formatDateTimeText(item.schedule_time)}</Text>
                  <Text className='ff-card-text'>{item.description || '暂无补充说明'}</Text>
                  <View className='ff-soft-button-row'>
                    {item.status !== 'completed' ? (
                      <Text className='ff-soft-button' onClick={() => void handleUpdateStatus(item, 'completed')}>
                        标记完成
                      </Text>
                    ) : (
                      <Text className='ff-soft-button' onClick={() => void handleUpdateStatus(item, 'pending')}>
                        重置待办
                      </Text>
                    )}
                    {item.status !== 'skipped' ? (
                      <Text className='ff-soft-button ff-soft-button--plain' onClick={() => void handleUpdateStatus(item, 'skipped')}>
                        标记跳过
                      </Text>
                    ) : null}
                    <Text className='ff-soft-button ff-soft-button--plain' onClick={() => void handleDelete(item)}>
                      删除
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View className='ff-card'>
            <Text className='ff-section-title'>当前筛选下还没有护理计划</Text>
            <Text className='ff-card-subtitle'>
              {loading ? '正在同步护理计划...' : '可以先新建一条计划，老人端会按时间收到提醒。'}
            </Text>
          </View>
        )}
      </View>

      <BottomNav active='care' />
    </View>
  );
}
