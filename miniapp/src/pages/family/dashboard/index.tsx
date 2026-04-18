import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';

const emotionData = [
  { day: '周一', score: 75 },
  { day: '周二', score: 80 },
  { day: '周三', score: 70 },
  { day: '周四', score: 85 },
  { day: '周五', score: 78 },
  { day: '周六', score: 82 },
  { day: '周日', score: 88 },
];

const quickActions = [
  { label: '情绪历史', path: '/pages/family/moods/index', tone: 'indigo' },
  { label: '查看周报', path: '/pages/family/reports/index', tone: 'amber' },
  { label: '预约咨询', path: '/pages/family/counseling/index', tone: 'pink' },
];

export default function FamilyDashboardPage() {
  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-hero'>
        <View className='ff-hero__top'>
          <View>
            <Text className='ff-kicker'>正在照护</Text>
            <Text className='ff-hero__title'>张翠花（母亲）</Text>
          </View>
          <View className='ff-avatar'>
            <Text>母</Text>
          </View>
        </View>
        <View className='ff-stat-grid'>
          <View className='ff-hero-stat'><Text>良好</Text><Text>今日心情</Text></View>
          <View className='ff-hero-stat'><Text>3次</Text><Text>今日互动</Text></View>
          <View className='ff-hero-stat'><Text>2条</Text><Text>未读通知</Text></View>
        </View>
      </View>

      <View className='ff-stack ff-stack--overlap'>
        <View className='ff-card'>
          <View className='ff-section-head'>
            <Text className='ff-section-title'>今日提醒完成情况</Text>
            <Text className='ff-green-link' onClick={() => Taro.redirectTo({ url: '/pages/family/care/index' })}>详情</Text>
          </View>
          <View className='ff-progress-list'>
            <View className='ff-progress-row'><View><Text className='ff-dot ff-dot--green' /><Text>服药提醒</Text></View><Text>2/2 已完成</Text></View>
            <View className='ff-progress-row'><View><Text className='ff-dot ff-dot--green' /><Text>饮水提醒</Text></View><Text>3/4 已完成</Text></View>
            <View className='ff-progress-row'><View><Text className='ff-dot ff-dot--amber' /><Text>活动提醒</Text></View><Text className='ff-amber-text'>0/1 待完成</Text></View>
          </View>
          <View className='ff-rate-block'>
            <View className='ff-progress-row'><Text>总完成率</Text><Text className='ff-rate-value'>71%</Text></View>
            <View className='ff-progress-track'><View className='ff-progress-fill' style={{ width: '71%' }} /></View>
          </View>
        </View>

        <View className='ff-card'>
          <View className='ff-section-head'>
            <View>
              <Text className='ff-section-title'>近7天情绪走势</Text>
              <Text className='ff-card-subtitle'>平均情绪分: 79.7</Text>
            </View>
            <Text className='ff-trend'>良好</Text>
          </View>
          <View className='ff-line-chart'>
            {emotionData.map((item) => (
              <View className='ff-line-chart__item' key={item.day}>
                <View className='ff-line-chart__track'>
                  <View className='ff-line-chart__bar' style={{ height: `${item.score}%` }} />
                </View>
                <Text>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ff-card'>
          <View className='ff-section-head'>
            <Text className='ff-section-title'>最近观看内容</Text>
            <Text className='ff-green-link' onClick={() => Taro.navigateTo({ url: '/pages/family/media/index' })}>管理</Text>
          </View>
          <View className='ff-list'>
            <View className='ff-media-line'>
              <View className='ff-media-thumb'>看</View>
              <View className='ff-media-line__body'><Text>2020年春节全家福</Text><Text>今天 14:32 · 完整观看</Text></View>
              <Text className='ff-heart ff-heart--active'>心</Text>
            </View>
            <View className='ff-media-line'>
              <View className='ff-media-thumb'>看</View>
              <View className='ff-media-line__body'><Text>孙女的生日派对</Text><Text>昨天 16:20 · 观看60%</Text></View>
              <Text className='ff-heart'>心</Text>
            </View>
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>最近AI互动概况</Text>
          <View className='ff-mini-grid'>
            <View className='ff-mini-card ff-mini-card--blue'><Text>12次</Text><Text>今日对话</Text></View>
            <View className='ff-mini-card ff-mini-card--amber'><Text>1条</Text><Text>关注话题</Text></View>
          </View>
          <View className='ff-warning-row'>
            <Text>注</Text>
            <Text>今日对话中提到"睡不好"，建议关注睡眠状况</Text>
          </View>
        </View>

        <View className='ff-action-grid'>
          {quickActions.map((item) => (
            <View
              key={item.label}
              className={`ff-action ff-action--${item.tone}`}
              onClick={() => Taro.navigateTo({ url: item.path })}
            >
              <Text className='ff-action__icon'>入</Text>
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>

        <View className='ff-alert-entry' onClick={() => Taro.redirectTo({ url: '/pages/family/alerts/index' })}>
          <View className='ff-alert-icon'>通</View>
          <View className='ff-alert-entry__body'>
            <Text>有2条未处理通知</Text>
            <Text>点击查看详情</Text>
          </View>
          <Text className='ff-chevron'>〉</Text>
        </View>
      </View>

      <BottomNav active='dashboard' />
    </View>
  );
}
