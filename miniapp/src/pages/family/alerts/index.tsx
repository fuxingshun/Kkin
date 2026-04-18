import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';

const tabs = ['未读(2)', '未处理(2)', '全部'];

const notifications = [
  {
    id: 1,
    title: '情绪波动提醒',
    content: '老人今天提到睡眠不佳，建议晚间主动联系。',
    time: '10分钟前',
    tag: '待处理',
    icon: '心',
    tone: 'amber',
  },
  {
    id: 2,
    title: '护理提醒未完成',
    content: '午后散步计划还没有确认完成。',
    time: '1小时前',
    tag: '未读',
    icon: '护',
    tone: 'blue',
  },
  {
    id: 3,
    title: '家人留言已播放',
    content: '早安问候已在老人端播放完毕。',
    time: '今天 08:10',
    tag: '已完成',
    icon: '留',
    tone: 'green',
  },
];

export default function AlertsPage() {
  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-topbar ff-topbar--sticky'>
        <View>
          <Text className='ff-topbar__title'>通知中心</Text>
          <Text className='ff-topbar__desc'>需要家属出手的事情会放在这里</Text>
        </View>
      </View>

      <View className='ff-tab-strip ff-tab-strip--top'>
        {tabs.map((tab, index) => (
          <Text key={tab} className={`ff-tab ${index === 0 ? 'ff-tab--active' : ''}`}>
            {tab}
          </Text>
        ))}
      </View>

      <View className='ff-stat-row'>
        <View className='ff-stat-pill'><Text>2</Text><Text>未读</Text></View>
        <View className='ff-stat-pill'><Text>2</Text><Text>未处理</Text></View>
        <View className='ff-stat-pill'><Text>5</Text><Text>今日通知</Text></View>
      </View>

      <View className='ff-stack ff-stack--page'>
        {notifications.map((item) => (
          <View className='ff-notice-card' key={item.id}>
            <View className={`ff-notice-card__icon ff-notice-card__icon--${item.tone}`}>
              <Text>{item.icon}</Text>
            </View>
            <View className='ff-notice-card__body'>
              <View className='ff-section-head ff-section-head--tight'>
                <Text className='ff-card-title'>{item.title}</Text>
                <Text className='ff-card-meta'>{item.time}</Text>
              </View>
              <Text className='ff-card-text'>{item.content}</Text>
              <View className='ff-soft-button-row'>
                <Text className={`ff-chip ff-chip--${item.tone}`}>{item.tag}</Text>
                {item.tag !== '已完成' ? <Text className='ff-soft-button'>立即处理</Text> : null}
              </View>
            </View>
          </View>
        ))}
      </View>

      <BottomNav active='alerts' />
    </View>
  );
}
