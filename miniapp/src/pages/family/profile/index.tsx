import { Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';

const menu = [
  { title: '老人信息', desc: '张翠花 · 78岁', icon: '人' },
  { title: '家庭成员', desc: '3 位家人共同照护', icon: '家' },
  { title: '消息提醒', desc: '情绪、护理和紧急通知', icon: '通' },
  { title: '隐私与安全', desc: '数据加密保护', icon: '安' },
  { title: '帮助与反馈', desc: '使用问题和服务支持', icon: '助' },
];

export default function ProfilePage() {
  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-hero ff-hero--green ff-hero--profile'>
        <View className='ff-profile-avatar'>家</View>
        <Text className='ff-hero__title'>李小雨</Text>
        <Text className='ff-hero__subtitle'>张翠花的女儿</Text>
        <View className='ff-stat-grid'>
          <View className='ff-hero-stat'><Text>128天</Text><Text>陪伴天数</Text></View>
          <View className='ff-hero-stat'><Text>3人</Text><Text>家庭成员</Text></View>
          <View className='ff-hero-stat'><Text>良好</Text><Text>照护状态</Text></View>
        </View>
      </View>

      <View className='ff-stack ff-stack--overlap'>
        <View className='ff-card'>
          <Text className='ff-section-title'>我的服务</Text>
          <View className='ff-menu-list'>
            {menu.map((item) => (
              <View className='ff-menu-row' key={item.title}>
                <View className='ff-menu-row__icon'>{item.icon}</View>
                <View className='ff-menu-row__body'>
                  <Text>{item.title}</Text>
                  <Text>{item.desc}</Text>
                </View>
                <Text className='ff-chevron'>〉</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <BottomNav active='profile' />
    </View>
  );
}
