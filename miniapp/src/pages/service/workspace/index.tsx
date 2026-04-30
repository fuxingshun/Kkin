import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const pendingRequests = [
  {
    name: '赵奶奶',
    age: 70,
    topic: '情绪低落，需要及时心理支持',
    time: '10 分钟前',
    urgency: '高优先级',
    tone: 'high',
  },
  {
    name: '孙阿姨',
    age: 66,
    topic: '睡眠质量下降，希望预约咨询',
    time: '28 分钟前',
    urgency: '中优先级',
    tone: 'medium',
  },
];

const todayAppointments = [
  { time: '09:00', name: '张翠花', topic: '焦虑情绪疏导', type: '视频咨询', icon: '▣' },
  { time: '14:30', name: '李秀英', topic: '家庭关系沟通', type: '电话咨询', icon: '☎' },
  { time: '16:00', name: '王大爷', topic: '孤独感陪伴', type: '视频咨询', icon: '▣' },
];

const weeklyStats = [
  { value: '12', label: '本周咨询', tone: 'teal' },
  { value: '8', label: '已完成', tone: 'green' },
  { value: '3', label: '待进行', tone: 'amber' },
  { value: '4.9', label: '满意度', tone: 'indigo' },
];

export default function ServiceWorkspacePage() {
  return (
    <View className='service-page service-page--figma'>
      <View className='sw-hero'>
        <View className='sw-hero__top'>
          <View>
            <Text className='sw-kicker'>心理咨询师</Text>
            <Text className='sw-title'>李心怡</Text>
          </View>
          <View className='sw-hero__avatar'>
            <Text>人</Text>
          </View>
        </View>
        <View className='sw-stat-grid'>
          <View className='sw-stat-card'>
            <Text className='sw-stat-card__value'>3</Text>
            <Text className='sw-stat-card__label'>今日咨询</Text>
          </View>
          <View className='sw-stat-card'>
            <Text className='sw-stat-card__value'>2</Text>
            <Text className='sw-stat-card__label'>待处理</Text>
          </View>
          <View className='sw-stat-card'>
            <Text className='sw-stat-card__value'>28</Text>
            <Text className='sw-stat-card__label'>本月完成</Text>
          </View>
        </View>
      </View>

      <View className='sw-content sw-content--lift'>
        <View className='sw-card'>
          <View className='sw-card__head'>
            <View className='sw-card__title-row'>
              <Text className='sw-card__icon sw-card__icon--amber'>!</Text>
              <Text className='sw-card__title'>待处理咨询请求</Text>
            </View>
            <Text className='sw-link' onClick={() => Taro.redirectTo({ url: '/pages/service/consultations/index' })}>
              查看全部
            </Text>
          </View>
          <View className='sw-list'>
            {pendingRequests.map((item) => (
              <View className={`sw-request sw-request--${item.tone}`} key={item.name}>
                <View className='sw-request__top'>
                  <View>
                    <Text className='sw-request__name'>{item.name}</Text>
                    <Text className='sw-request__meta'>{item.age}岁 · {item.time}</Text>
                  </View>
                  <Text className={`sw-badge sw-badge--${item.tone}`}>{item.urgency}</Text>
                </View>
                <Text className='sw-request__topic'>{item.topic}</Text>
                <View className='sw-request__actions'>
                  <Text
                    className='sw-mini-btn sw-mini-btn--primary'
                    onClick={() => Taro.showToast({ title: '已接受咨询请求', icon: 'success' })}
                  >
                    接受
                  </Text>
                  <Text
                    className='sw-mini-btn'
                    onClick={() => Taro.showToast({ title: '已暂缓处理', icon: 'none' })}
                  >
                    暂缓
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className='sw-card'>
          <View className='sw-card__head'>
            <View className='sw-card__title-row'>
              <Text className='sw-card__icon sw-card__icon--teal'>□</Text>
              <Text className='sw-card__title'>今日咨询安排</Text>
            </View>
            <Text className='sw-link' onClick={() => Taro.redirectTo({ url: '/pages/service/schedule/index' })}>
              日程
            </Text>
          </View>
          <View className='sw-list'>
            {todayAppointments.map((item) => (
              <View className='sw-appointment' key={`${item.time}-${item.name}`}>
                <View className='sw-appointment__time'>
                  <Text>{item.time}</Text>
                </View>
                <View className='sw-appointment__body'>
                  <View className='sw-appointment__top'>
                    <View className='sw-avatar'>
                      <Text>{item.name.slice(0, 1)}</Text>
                    </View>
                    <View>
                      <Text className='sw-appointment__name'>{item.name}</Text>
                      <Text className='sw-appointment__topic'>{item.topic}</Text>
                    </View>
                  </View>
                  <View className='sw-appointment__bottom'>
                    <Text className='sw-appointment__type'>{item.icon} {item.type}</Text>
                    <Text className='sw-enter-btn'>进入咨询室</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className='sw-card'>
          <View className='sw-card__title-row sw-card__title-row--solo'>
            <Text className='sw-card__icon sw-card__icon--green'>↗</Text>
            <Text className='sw-card__title'>本周数据</Text>
          </View>
          <View className='sw-week-grid'>
            {weeklyStats.map((item) => (
              <View className={`sw-week-card sw-week-card--${item.tone}`} key={item.label}>
                <Text className='sw-week-card__value'>{item.value}</Text>
                <Text className='sw-week-card__label'>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <ServiceTabBar active='workspace' />
    </View>
  );
}
