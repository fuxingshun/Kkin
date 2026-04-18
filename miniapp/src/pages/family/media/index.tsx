import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';

const tabs = ['全部', '图片', '视频'];

const memories = [
  { id: 1, title: '2020年春节全家福', type: '图片', count: '12张', tone: 'green' },
  { id: 2, title: '孙女的生日派对', type: '视频', count: '3段', tone: 'pink' },
  { id: 3, title: '老家院子的桂花', type: '图片', count: '8张', tone: 'amber' },
  { id: 4, title: '一起去公园散步', type: '视频', count: '2段', tone: 'blue' },
];

export default function FamilyMediaPage() {
  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-sub-topbar ff-sub-topbar--green'>
        <Text className='ff-back' onClick={() => Taro.redirectTo({ url: '/pages/family/dashboard/index' })}>‹</Text>
        <Text className='ff-sub-topbar__title'>回忆内容</Text>
        <Text className='ff-sub-topbar__spacer'> </Text>
      </View>

      <View className='ff-hero ff-hero--green ff-hero--memory'>
        <View>
          <Text className='ff-kicker'>回忆库</Text>
          <Text className='ff-hero__title'>把熟悉的人和事放在这里</Text>
          <Text className='ff-hero__subtitle'>老人端会在陪伴中温和播放</Text>
        </View>
        <View className='ff-stat-grid'>
          <View className='ff-hero-stat'><Text>28</Text><Text>回忆合集</Text></View>
          <View className='ff-hero-stat'><Text>156</Text><Text>内容数量</Text></View>
        </View>
      </View>

      <View className='ff-stack ff-stack--overlap'>
        <View className='ff-tab-strip ff-tab-strip--card'>
          {tabs.map((tab, index) => (
            <Text key={tab} className={`ff-tab ${index === 0 ? 'ff-tab--green' : ''}`}>{tab}</Text>
          ))}
        </View>

        <View className='ff-memory-grid'>
          {memories.map((item) => (
            <View
              className='ff-memory-card'
              key={item.id}
              onClick={() => Taro.navigateTo({ url: `/pages/family/media-detail/index?id=${item.id}` })}
            >
              <View className={`ff-memory-card__cover ff-memory-card__cover--${item.tone}`}>
                <Text>{item.type.slice(0, 1)}</Text>
              </View>
              <View className='ff-memory-card__body'>
                <Text>{item.title}</Text>
                <Text>{item.type} · {item.count}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <BottomNav active='dashboard' />
    </View>
  );
}
