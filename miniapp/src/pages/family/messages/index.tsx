import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';

const tabs = ['全部', '文字', '语音', '视频'];

const messages = [
  {
    id: 1,
    type: '文字',
    title: '早安问候',
    content: '妈妈，记得按时吃药，下午我会视频通话看看您。',
    time: '今天 08:00',
    status: '已播放',
    tone: 'green',
    icon: '文',
  },
  {
    id: 2,
    type: '语音',
    title: '睡前陪伴',
    content: '语音留言：今天辛苦啦，早点休息，明天继续陪您聊天。',
    time: '昨天 21:00',
    status: '已播放',
    tone: 'green',
    icon: '音',
  },
  {
    id: 3,
    type: '视频',
    title: '生日祝福',
    content: '视频留言：孙女给奶奶唱生日歌。',
    time: '3天前',
    status: '待播放',
    tone: 'amber',
    icon: '视',
  },
];

export default function FamilyMessagesPage() {
  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-topbar ff-topbar--sticky'>
        <View>
          <Text className='ff-topbar__title'>留言管理</Text>
          <Text className='ff-topbar__desc'>把问候安排到合适的时间出现</Text>
        </View>
        <Button className='ff-new-button'>新建留言</Button>
      </View>

      <View className='ff-tab-strip'>
        {tabs.map((tab, index) => (
          <Text key={tab} className={`ff-tab ${index === 0 ? 'ff-tab--active' : ''}`}>
            {tab}
          </Text>
        ))}
      </View>

      <View className='ff-stack ff-stack--page'>
        {messages.map((item) => (
          <View className='ff-message-card' key={item.id}>
            <View className={`ff-message-card__icon ff-message-card__icon--${item.tone}`}>
              <Text>{item.icon}</Text>
            </View>
            <View className='ff-message-card__body'>
              <View className='ff-section-head ff-section-head--tight'>
                <View>
                  <Text className='ff-card-title'>{item.title}</Text>
                  <Text className='ff-card-meta'>{item.time}</Text>
                </View>
                <Text className={`ff-chip ff-chip--${item.tone}`}>{item.status}</Text>
              </View>
              <Text className='ff-card-text'>{item.content}</Text>
              <View className='ff-soft-button-row'>
                <Text className='ff-soft-button'>重新发送</Text>
                <Text className='ff-soft-button ff-soft-button--plain'>查看记录</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <Button
        className='ff-fab'
        onClick={() => {
          Taro.showToast({ title: '新建留言', icon: 'none' });
        }}
      >
        +
      </Button>

      <BottomNav active='messages' />
    </View>
  );
}
