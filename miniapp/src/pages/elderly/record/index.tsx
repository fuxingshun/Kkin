import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';
import {
  createMoodRecord,
  getMoodRecords,
  getTodayMoodRecords,
  moodLabelMap,
  type MoodRecord,
  type MoodType,
} from '@/services/elderly';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';
import { formatDateTimeText } from '@/utils/format';
import { getElderlySession } from '@/utils/session';

const emotions: Array<{ label: string; value: MoodType; tone: string; score: number }> = [
  { label: '开心', value: 'happy', tone: 'green', score: 9 },
  { label: '平稳', value: 'calm', tone: 'blue', score: 7 },
  { label: '疲惫', value: 'tired', tone: 'gray', score: 5 },
  { label: '难过', value: 'sad', tone: 'purple', score: 3 },
  { label: '焦虑', value: 'anxious', tone: 'amber', score: 4 },
  { label: '生气', value: 'angry', tone: 'red', score: 2 },
];

const sleepQuality = ['很好', '一般', '较差'];
const appetite = ['很好', '一般', '较差'];
const activities = [
  { label: '散步', value: 'walk' },
  { label: '做操', value: 'exercise' },
  { label: '喝水', value: 'water' },
  { label: '户外', value: 'outdoor' },
];

export default function ElderlyRecordPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const { familyId, elderlyId } = getElderlySession();
  const [selectedEmotion, setSelectedEmotion] = useState<MoodType | ''>('happy');
  const [selectedSleep, setSelectedSleep] = useState('');
  const [selectedAppetite, setSelectedAppetite] = useState('');
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [medicationTaken, setMedicationTaken] = useState(false);
  const [records, setRecords] = useState<MoodRecord[]>([]);
  const [todayRecords, setTodayRecords] = useState<MoodRecord[]>([]);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [list, todayList] = await Promise.all([
        getMoodRecords(familyId, elderlyId, 20),
        getTodayMoodRecords(familyId, elderlyId),
      ]);
      setRecords(list);
      setTodayRecords(todayList);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      Taro.stopPullDownRefresh();
    }
  }, [elderlyId, familyId]);

  useDidShow(() => {
    void loadData();
  });

  usePullDownRefresh(() => {
    void loadData();
  });

  const toggleActivity = (value: string) => {
    setSelectedActivities((items) =>
      items.includes(value) ? items.filter((item) => item !== value) : [...items, value]
    );
  };

  const selectedEmotionMeta = useMemo(
    () => emotions.find((item) => item.value === selectedEmotion),
    [selectedEmotion]
  );
  const recentRecords = useMemo(() => records.slice(0, 7), [records]);
  const todayRecord = todayRecords[0] || null;
  const averageScore = useMemo(() => {
    if (!recentRecords.length) {
      return 0;
    }

    return (
      recentRecords.reduce((total, item) => total + (item.mood_score || 0), 0) / recentRecords.length
    );
  }, [recentRecords]);

  async function saveRecord() {
    if (todayRecord) {
      Taro.showToast({ title: '今天已经记录过了', icon: 'none' });
      return;
    }

    if (!selectedEmotion || !selectedEmotionMeta) {
      Taro.showToast({ title: '请选择今天的感觉', icon: 'none' });
      return;
    }

    const activityText = selectedActivities
      .map((value) => activities.find((item) => item.value === value)?.label)
      .filter(Boolean)
      .join('、') || '未记录';
    const note = [
      `睡眠：${selectedSleep || '未记录'}`,
      `食欲：${selectedAppetite || '未记录'}`,
      `活动：${activityText}`,
      `服药：${medicationTaken ? '已确认' : '未确认'}`,
    ].join('；');

    try {
      setSaving(true);
      await createMoodRecord(familyId, selectedEmotion, elderlyId, {
        moodScore: selectedEmotionMeta.score,
        note,
        triggerEvent: activityText,
      });
      Taro.showToast({ title: '已保存', icon: 'success' });
      setSelectedEmotion('happy');
      setSelectedSleep('');
      setSelectedAppetite('');
      setSelectedActivities([]);
      setMedicationTaken(false);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className={`ef-page ef-page--tab ${preferenceClassName}`}>
      <View className='ef-record-hero' style={{ background: '#0EA5A5' }}>
        <Text className='ef-page-head__title'>今日记录</Text>
        <Text className='ef-record-hero__desc'>记录您的每日状态，帮助我们更好地了解和照顾您</Text>
      </View>

      <View className='ef-record-stack'>
        <View className='ef-panel ef-panel--lift'>
          <Text className='ef-section-title'>今日情绪</Text>
          {todayRecord ? (
            <View className='ef-specialty' style={{ marginTop: '20rpx' }}>
              <Text>今天已记录：{moodLabelMap[todayRecord.mood_type] || todayRecord.mood_type}</Text>
              <Text>记录时间：{formatDateTimeText(todayRecord.recorded_at || todayRecord.created_at || '')}</Text>
            </View>
          ) : (
            <Text className='ef-record-meta'>记录时间：现在 · 当前：{selectedEmotionMeta?.label || '开心'}</Text>
          )}
          <View className='ef-emotion-grid'>
            {emotions.map((emotion) => (
              <View
                key={emotion.value}
                className={`ef-emotion ef-emotion--${emotion.tone} ${selectedEmotion === emotion.value ? 'ef-emotion--active' : ''}`}
                onClick={() => {
                  if (!todayRecord) {
                    setSelectedEmotion(emotion.value);
                  }
                }}
                style={todayRecord ? { opacity: 0.45 } : undefined}
              >
                <Text className='ef-emotion__icon'>{emotion.label.slice(0, 1)}</Text>
                <Text>{emotion.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ef-panel'>
          <View className='ef-title-row'>
            <View className='ef-square-icon'>眠</View>
            <Text className='ef-section-title'>睡眠情况</Text>
          </View>
          <View className='ef-choice-grid'>
            {sleepQuality.map((item) => (
              <View
                key={item}
                className={`ef-choice ${selectedSleep === item ? 'ef-choice--active' : ''}`}
                onClick={() => {
                  if (!todayRecord) {
                    setSelectedSleep(item);
                  }
                }}
                style={todayRecord ? { opacity: 0.45 } : undefined}
              >
                <Text>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ef-panel'>
          <View className='ef-title-row'>
            <View className='ef-square-icon'>食</View>
            <Text className='ef-section-title'>食欲情况</Text>
          </View>
          <View className='ef-choice-grid'>
            {appetite.map((item) => (
              <View
                key={item}
                className={`ef-choice ${selectedAppetite === item ? 'ef-choice--active' : ''}`}
                onClick={() => {
                  if (!todayRecord) {
                    setSelectedAppetite(item);
                  }
                }}
                style={todayRecord ? { opacity: 0.45 } : undefined}
              >
                <Text>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ef-panel'>
          <Text className='ef-section-title'>今日活动</Text>
          <View className='ef-activity-grid'>
            {activities.map((item) => {
              const active = selectedActivities.includes(item.value);
              return (
                <View
                  key={item.value}
                  className={`ef-activity ${active ? 'ef-activity--active' : ''}`}
                  onClick={() => {
                    if (!todayRecord) {
                      toggleActivity(item.value);
                    }
                  }}
                  style={todayRecord ? { opacity: 0.45 } : undefined}
                >
                  <Text className='ef-emotion__icon'>{active ? '✓' : '动'}</Text>
                  <Text>{item.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View className='ef-panel'>
          <View className='ef-title-row'>
            <View className='ef-square-icon'>药</View>
            <Text className='ef-section-title'>服药确认</Text>
          </View>
          <Button
            className={`ef-med-button ${medicationTaken ? 'ef-med-button--active' : ''}`}
            onClick={() => {
              if (!todayRecord) {
                setMedicationTaken((value) => !value);
              }
            }}
            style={todayRecord ? { opacity: 0.45 } : undefined}
          >
            {medicationTaken ? '今日已服药' : '点击确认服药'}
          </Button>
        </View>

        <Button className='ef-save-button' disabled={Boolean(todayRecord)} loading={saving} onClick={saveRecord}>
          {todayRecord ? '今日已记录' : '保存今日记录'}
        </Button>

        <View className='ef-panel'>
          <Text className='ef-section-title'>近7日数据</Text>
          <View className='ef-trend-list'>
            <View className='ef-trend-row'><Text>情绪记录</Text><Text>{records.length}次</Text></View>
            <View className='ef-trend-row'><Text>最近状态</Text><Text>{records[0]?.mood_type ? emotions.find((item) => item.value === records[0].mood_type)?.label : '未记录'}</Text></View>
            <View className='ef-trend-row'><Text>服药确认</Text><Text>{records.filter((item) => item.note?.includes('已确认')).length}次</Text></View>
            <View className='ef-trend-row'><Text>平均分</Text><Text>{recentRecords.length ? averageScore.toFixed(1) : '--'}</Text></View>
          </View>
          <Button
            className='ef-soft-link-button'
            onClick={() => Taro.navigateTo({ url: '/pages/elderly/record-history/index' })}
          >
            查看详细趋势
          </Button>
        </View>
      </View>

      <ElderlyTabBar active='record' />
    </View>
  );
}
