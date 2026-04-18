import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';

const trend = [
  { day: '周一', value: 72 },
  { day: '周二', value: 78 },
  { day: '周三', value: 68 },
  { day: '周四', value: 84 },
  { day: '周五', value: 76 },
  { day: '周六', value: 82 },
  { day: '周日', value: 88 },
];

const distribution = [
  { label: '开心', value: 45, tone: 'green' },
  { label: '平静', value: 35, tone: 'blue' },
  { label: '疲惫', value: 15, tone: 'amber' },
  { label: '低落', value: 5, tone: 'pink' },
];

const records = [
  { day: '今天', mood: '开心', desc: '和家人视频后明显更放松', time: '20:10' },
  { day: '昨天', mood: '平静', desc: '午休较好，晚间聊天积极', time: '19:40' },
  { day: '周一', mood: '有点累', desc: '提到睡眠不踏实，需要继续关注', time: '18:20' },
];

export default function FamilyMoodsPage() {
  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-sub-topbar'>
        <Text className='ff-back' onClick={() => Taro.redirectTo({ url: '/pages/family/dashboard/index' })}>‹</Text>
        <Text className='ff-sub-topbar__title'>情绪历史</Text>
        <Text className='ff-sub-topbar__spacer'> </Text>
      </View>

      <View className='ff-stack ff-stack--page'>
        <View className='ff-overview-card'>
          <View>
            <Text className='ff-kicker'>本周情绪概览</Text>
            <Text className='ff-score'>79.7</Text>
            <Text className='ff-hero__subtitle'>整体情绪良好，周末有明显提升</Text>
          </View>
          <View className='ff-avatar ff-avatar--glass'>
            <Text>心</Text>
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>近7天情绪走势</Text>
          <View className='ff-line-chart ff-line-chart--large'>
            {trend.map((item) => (
              <View className='ff-line-chart__item' key={item.day}>
                <View className='ff-line-chart__track'>
                  <View className='ff-line-chart__bar' style={{ height: `${item.value}%` }} />
                </View>
                <Text>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>情绪分布</Text>
          <View className='ff-distribution'>
            {distribution.map((item) => (
              <View className='ff-distribution__row' key={item.label}>
                <Text>{item.label}</Text>
                <View className='ff-distribution__track'>
                  <View className={`ff-distribution__fill ff-distribution__fill--${item.tone}`} style={{ width: `${item.value}%` }} />
                </View>
                <Text>{item.value}%</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ff-card'>
          <View className='ff-section-head'>
            <Text className='ff-section-title'>情绪记录</Text>
            <Text className='ff-green-link'>筛选</Text>
          </View>
          <View className='ff-list'>
            {records.map((item) => (
              <View className='ff-record-row' key={`${item.day}-${item.time}`}>
                <View className='ff-record-row__date'>
                  <Text>{item.day}</Text>
                  <Text>{item.time}</Text>
                </View>
                <View className='ff-record-row__body'>
                  <Text>{item.mood}</Text>
                  <Text>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <BottomNav active='dashboard' />
    </View>
  );
}
