import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';

const counselors = [
  {
    id: 1,
    name: '李心怡',
    title: '资深心理咨询师',
    experience: '12年',
    specialty: '老年心理、情绪疏导',
    rating: 4.8,
    consultations: 500,
    available: true,
    matchScore: 95,
  },
  {
    id: 2,
    name: '王建国',
    title: '心理治疗师',
    experience: '8年',
    specialty: '睡眠问题、焦虑调节',
    rating: 4.5,
    consultations: 320,
    available: true,
    matchScore: 88,
  },
  {
    id: 3,
    name: '张婷婷',
    title: '临床心理医生',
    experience: '15年',
    specialty: '慢性病心理、健康焦虑',
    rating: 4.9,
    consultations: 680,
    available: false,
    matchScore: 92,
  },
  {
    id: 4,
    name: '刘明辉',
    title: '家庭治疗师',
    experience: '10年',
    specialty: '家庭关系、代际沟通',
    rating: 4.7,
    consultations: 420,
    available: true,
    matchScore: 85,
  },
  {
    id: 5,
    name: '赵雪梅',
    title: '认知行为治疗师',
    experience: '9年',
    specialty: '记忆认知、失落哀伤',
    rating: 4.6,
    consultations: 290,
    available: true,
    matchScore: 81,
  },
];

const filterOptions = [
  { id: 'all', label: '全部' },
  { id: 'online', label: '在线' },
  { id: 'high-rating', label: '高评分' },
  { id: 'experienced', label: '资深' },
];

export default function ElderlyCounselorListPage() {
  const [selectedFilter, setSelectedFilter] = useState('all');

  return (
    <View className='pc-page counselor-page ef-page--tab'>
      <View className='pc-sub-topbar'>
        <Text className='pc-topbar-button' onClick={() => Taro.navigateBack()}>‹</Text>
        <Text className='pc-sub-title'>咨询师列表</Text>
        <Text className='pc-topbar-button'>筛</Text>
      </View>

      <View className='pc-filter-strip'>
        {filterOptions.map((option) => (
          <Text
            key={option.id}
            className={`pc-filter ${selectedFilter === option.id ? 'pc-filter--active' : ''}`}
            onClick={() => setSelectedFilter(option.id)}
          >
            {option.label}
          </Text>
        ))}
      </View>

      <View className='pc-counselor-content'>
        <View className='pc-list-title-row'>
          <Text className='pc-title-icon'>✦</Text>
          <Text className='pc-section-title'>为您匹配</Text>
          <Text className='pc-list-caption'>（按匹配度排序）</Text>
        </View>

        <View className='pc-counselor-list'>
          {counselors.map((counselor) => (
            <View className='pc-counselor-card' key={counselor.id}>
              <View className='pc-counselor-card__top'>
                <View className='pc-match-chip'>
                  <Text>✦</Text>
                  <Text>匹配度 {counselor.matchScore}%</Text>
                </View>
                <Text className={`pc-status-chip ${counselor.available ? 'pc-status-chip--online' : ''}`}>
                  {counselor.available ? '在线' : '离线'}
                </Text>
              </View>

              <View className='pc-counselor-info'>
                <View className='pc-counselor-avatar'>
                  <Text>人</Text>
                </View>
                <View className='pc-counselor-info__body'>
                  <Text className='pc-counselor-name'>{counselor.name}</Text>
                  <Text className='pc-counselor-title'>{counselor.title}</Text>
                  <Text className='pc-counselor-meta'>时 从业 {counselor.experience} · 星 {counselor.rating} · {counselor.consultations}次咨询</Text>
                </View>
              </View>

              <View className='pc-specialty'>
                <Text>擅长领域：{counselor.specialty}</Text>
              </View>

              <View className='pc-action-row'>
                <View className={`pc-action-button pc-action-button--plain ${!counselor.available ? 'pc-action-button--disabled' : ''}`}>
                  <Text>电 电话咨询</Text>
                </View>
                <View className={`pc-action-button pc-action-button--primary ${!counselor.available ? 'pc-action-button--disabled' : ''}`}>
                  <Text>视 视频咨询</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className='pc-section pc-section--tip'>
        <View className='pc-blue-tip'>
          <Text className='pc-tip-title'>智能匹配说明</Text>
          <Text className='pc-blue-tip-text'>系统根据您的年龄、健康状况、情绪记录等信息，为您推荐最适合的咨询师。匹配度越高，咨询效果可能越好。</Text>
        </View>
      </View>

      <ElderlyTabBar active='consulting' />
    </View>
  );
}
