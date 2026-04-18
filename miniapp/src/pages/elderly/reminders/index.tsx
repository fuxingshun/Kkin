import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import {
  getScheduleHistory,
  getTodaySchedules,
  updateScheduleStatus,
  type Schedule,
} from '@/services/elderly';
import { getElderlySession } from '@/utils/session';

const categoryDefs = [
  { label: '全部', type: '' },
  { label: '用药', type: 'medication' },
  { label: '饮食', type: 'meal' },
  { label: '活动', type: 'exercise' },
  { label: '复诊', type: 'checkup' },
];

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value?: string) {
  const date = parseDate(value);
  if (!date) return '--:--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateTime(value?: string) {
  const date = parseDate(value);
  if (!date) return '时间待定';
  return `${date.getMonth() + 1}月${date.getDate()}日 ${formatTime(value)}`;
}

function getTaskMark(type?: Schedule['schedule_type']) {
  if (type === 'medication') return '药';
  if (type === 'meal') return '餐';
  if (type === 'exercise') return '动';
  if (type === 'checkup') return '诊';
  return '提';
}

function getStatusLabel(status?: Schedule['status']) {
  if (status === 'completed') return '已完成';
  if (status === 'skipped') return '已跳过';
  if (status === 'missed') return '已错过';
  return '待处理';
}

function getStatusTone(status?: Schedule['status']) {
  if (status === 'completed') return 'ef-pill--done';
  if (status === 'skipped') return 'ef-pill--skipped';
  if (status === 'missed') return 'ef-pill--missed';
  return 'ef-pill--wait';
}

export default function ElderlyRemindersPage() {
  const { familyId } = getElderlySession();
  const [tasks, setTasks] = useState<Schedule[]>([]);
  const [historyTasks, setHistoryTasks] = useState<Schedule[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [todaySchedules, archiveSchedules] = await Promise.all([
        getTodaySchedules(familyId),
        getScheduleHistory(familyId, 40),
      ]);
      setTasks(todaySchedules);
      setHistoryTasks(archiveSchedules);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      Taro.stopPullDownRefresh();
    }
  }, [familyId]);

  useDidShow(() => {
    void loadData();
  });

  usePullDownRefresh(() => {
    void loadData();
  });

  const filteredTasks = useMemo(() => {
    if (!activeCategory) return tasks;
    return tasks.filter((item) => item.schedule_type === activeCategory);
  }, [activeCategory, tasks]);

  const filteredHistoryTasks = useMemo(() => {
    if (!activeCategory) return historyTasks;
    return historyTasks.filter((item) => item.schedule_type === activeCategory);
  }, [activeCategory, historyTasks]);

  const completedCount = tasks.filter((item) => item.status === 'completed').length;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  async function completeTask(taskId?: number) {
    if (!taskId) return;
    try {
      await updateScheduleStatus(taskId, 'completed');
      Taro.showToast({ title: '已完成', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  return (
    <View className='ef-page ef-page--sub'>
      <View className='ef-topbar ef-topbar--sticky'>
        <Text className='ef-topbar__back' onClick={() => Taro.redirectTo({ url: '/pages/elderly/home/index' })}>〈</Text>
        <Text className='ef-topbar__title'>提醒任务</Text>
        <Text className='ef-topbar__space' />
      </View>

      <View className='ef-progress-card'>
        <View className='ef-progress-card__top'>
          <View>
            <Text className='ef-progress-card__label'>今日完成度</Text>
            <Text className='ef-progress-card__value'>{completedCount}/{tasks.length}</Text>
          </View>
          <View className='ef-progress-ring'>
            <Text>{progress}%</Text>
          </View>
        </View>
        <View className='ef-progress-track'>
          <View className='ef-progress-fill' style={{ width: `${progress}%` }} />
        </View>
      </View>

      <View className='ef-chip-scroll'>
        {categoryDefs.map((category) => {
          const count = category.type ? tasks.filter((item) => item.schedule_type === category.type).length : tasks.length;
          const active = activeCategory === category.type;
          return (
            <Text
              className='ef-filter-chip'
              key={category.label}
              style={active ? { borderColor: '#3b82a6', background: '#e6f2f7', color: '#2c6b8a' } : undefined}
              onClick={() => setActiveCategory(category.type)}
            >
              {category.label} <Text>({count})</Text>
            </Text>
          );
        })}
      </View>

      <View className='ef-content-pad'>
        <Text className='ef-section-title'>今日任务</Text>
        <View className='ef-list'>
          {filteredTasks.length ? (
            filteredTasks.map((task) => {
              const done = task.status === 'completed';
              return (
                <View className={`ef-task-card ${done ? 'ef-task-card--done' : ''}`} key={task.id || task.title}>
                  <View className={`ef-reminder__icon ${done ? 'ef-reminder__icon--done' : ''}`}>
                    <Text>{getTaskMark(task.schedule_type)}</Text>
                  </View>
                  <View className='ef-task-card__body'>
                    <View className='ef-inline'>
                      <Text className='ef-card-title'>{task.title}</Text>
                      <Text className={`ef-task-time ${done ? 'ef-task-time--done' : ''}`}>时间 {formatTime(task.schedule_time)}</Text>
                    </View>
                    <Text className='ef-card-text'>{task.description || '家人为您设置的提醒'}</Text>
                    {done ? (
                      <Text className='ef-done-badge'>已完成</Text>
                    ) : (
                      <Button className='ef-task-button' onClick={() => void completeTask(task.id)}>标记完成</Button>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <View className='ef-task-card'>
              <View className='ef-reminder__icon'><Text>空</Text></View>
              <View className='ef-task-card__body'>
                <Text className='ef-card-title'>暂无任务</Text>
                <Text className='ef-card-text'>家属端新增护理计划后会同步到这里。</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View className='ef-content-pad'>
        <Button className='ef-history-button' onClick={() => setShowHistory((value) => !value)}>
          {showHistory ? '收起历史任务' : `查看历史任务 (${historyTasks.length})`}
        </Button>

        {showHistory ? (
          <View className='ef-list' style={{ marginTop: '24rpx' }}>
            {filteredHistoryTasks.length ? (
              filteredHistoryTasks.map((task) => (
                <View className='ef-history-card' key={`history-${task.id || task.title}-${task.schedule_time}`}>
                  <View className='ef-history-head'>
                    <View className='ef-history-icon'>
                      <Text>{getTaskMark(task.schedule_type)}</Text>
                    </View>
                    <View className='ef-task-card__body'>
                      <View className='ef-inline'>
                        <Text className='ef-card-title'>{task.title}</Text>
                        <Text className={`ef-pill ${getStatusTone(task.status)}`}>{getStatusLabel(task.status)}</Text>
                      </View>
                      <Text className='ef-card-text'>{task.description || '已归档的提醒任务'}</Text>
                      <View className='ef-history-meta'>
                        <Text className='ef-muted'>{formatDateTime(task.schedule_time)}</Text>
                        {task.repeat_type ? <Text className='ef-muted'>重复 {task.repeat_type}</Text> : null}
                      </View>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View className='ef-history-card'>
                <Text className='ef-card-title'>还没有历史任务</Text>
                <Text className='ef-card-text'>等今天的提醒开始被完成或归档后，这里会自动累积记录。</Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}
