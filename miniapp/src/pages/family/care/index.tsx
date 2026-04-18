import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';

const filters = ['全部', '用药', '饮食', '运动', '复诊'];

const plans = [
  {
    id: 1,
    title: '早饭后服药',
    time: '08:30',
    desc: '降压药 1 片，已同步老人端提醒',
    status: '今日已完成',
    type: '用',
    tone: 'green',
  },
  {
    id: 2,
    title: '午后散步',
    time: '15:00',
    desc: '天气合适时在小区慢走 20 分钟',
    status: '待提醒',
    type: '动',
    tone: 'blue',
  },
  {
    id: 3,
    title: '晚间血压记录',
    time: '20:30',
    desc: '记录血压后同步给家人查看',
    status: '待完成',
    type: '记',
    tone: 'amber',
  },
];

export default function CarePage() {
  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-hero ff-hero--green'>
        <View className='ff-hero__top'>
          <View>
            <Text className='ff-kicker'>护理计划</Text>
            <Text className='ff-hero__title'>把照护拆成清楚的提醒</Text>
          </View>
          <View className='ff-avatar ff-avatar--glass'>
            <Text>护</Text>
          </View>
        </View>
        <View className='ff-stat-grid'>
          <View className='ff-hero-stat'><Text>8</Text><Text>总计划数</Text></View>
          <View className='ff-hero-stat'><Text>5</Text><Text>今日任务</Text></View>
          <View className='ff-hero-stat'><Text>71%</Text><Text>完成率</Text></View>
        </View>
      </View>

      <View className='ff-stack ff-stack--overlap'>
        <View className='ff-tab-strip ff-tab-strip--card'>
          {filters.map((item, index) => (
            <Text key={item} className={`ff-tab ${index === 0 ? 'ff-tab--green' : ''}`}>
              {item}
            </Text>
          ))}
        </View>

        <View className='ff-card'>
          <View className='ff-section-head'>
            <View>
              <Text className='ff-section-title'>今日护理计划</Text>
              <Text className='ff-card-subtitle'>5 个任务，3 个已完成</Text>
            </View>
            <Text className='ff-green-link'>新建</Text>
          </View>
          <View className='ff-progress-track ff-progress-track--green'>
            <View className='ff-progress-fill ff-progress-fill--green' style={{ width: '71%' }} />
          </View>
        </View>

        {plans.map((item) => (
          <View className='ff-care-card' key={item.id}>
            <View className={`ff-care-card__icon ff-care-card__icon--${item.tone}`}>
              <Text>{item.type}</Text>
            </View>
            <View className='ff-care-card__body'>
              <View className='ff-section-head ff-section-head--tight'>
                <Text className='ff-card-title'>{item.title}</Text>
                <Text className={`ff-chip ff-chip--${item.tone}`}>{item.status}</Text>
              </View>
              <Text className='ff-card-meta'>{item.time}</Text>
              <Text className='ff-card-text'>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <BottomNav active='care' />
    </View>
  );
}
