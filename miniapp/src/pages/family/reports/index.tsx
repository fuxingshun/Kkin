import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';

const metrics = [
  { label: '情绪状态', value: 82, desc: '较上周提升 6%', tone: 'green' },
  { label: '睡眠质量', value: 74, desc: '睡眠略有波动', tone: 'blue' },
  { label: '护理完成', value: 71, desc: '仍有 2 项待提升', tone: 'amber' },
];

const activity = [
  { label: '陪伴对话', value: 42 },
  { label: '回忆观看', value: 28 },
  { label: '家人留言', value: 18 },
  { label: '护理提醒', value: 12 },
];

export default function ReportsPage() {
  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-sub-topbar'>
        <Text className='ff-back' onClick={() => Taro.redirectTo({ url: '/pages/family/dashboard/index' })}>‹</Text>
        <Text className='ff-sub-topbar__title'>健康周报</Text>
        <Text className='ff-sub-topbar__spacer'> </Text>
      </View>

      <View className='ff-stack ff-stack--page'>
        <View className='ff-report-hero'>
          <Text className='ff-kicker'>2026.04.08 - 04.14</Text>
          <Text className='ff-hero__title'>本周整体状态良好</Text>
          <Text className='ff-hero__subtitle'>情绪稳定，陪伴互动增加，护理完成率仍可提升</Text>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>核心指标</Text>
          <View className='ff-metric-list'>
            {metrics.map((item) => (
              <View className='ff-metric-row' key={item.label}>
                <View className='ff-metric-row__head'>
                  <Text>{item.label}</Text>
                  <Text>{item.value}分</Text>
                </View>
                <View className='ff-progress-track'>
                  <View className={`ff-progress-fill ff-progress-fill--${item.tone}`} style={{ width: `${item.value}%` }} />
                </View>
                <Text className='ff-card-meta'>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>活动分布</Text>
          <View className='ff-distribution'>
            {activity.map((item) => (
              <View className='ff-distribution__row' key={item.label}>
                <Text>{item.label}</Text>
                <View className='ff-distribution__track'>
                  <View className='ff-distribution__fill ff-distribution__fill--blue' style={{ width: `${item.value}%` }} />
                </View>
                <Text>{item.value}%</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>本周重点</Text>
          <View className='ff-list'>
            <View className='ff-highlight-row'><Text>好</Text><Text>老人对家庭照片反应积极，观看完整率提高。</Text></View>
            <View className='ff-highlight-row'><Text>注</Text><Text>两次提到睡眠浅，建议睡前减少提醒频率。</Text></View>
            <View className='ff-highlight-row'><Text>建</Text><Text>可以补充孙辈近期视频，增强陪伴感。</Text></View>
          </View>
        </View>

        <Button className='ff-download-button'>下载完整周报</Button>
      </View>

      <BottomNav active='dashboard' />
    </View>
  );
}
