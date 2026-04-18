import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';

type NavKey = 'dashboard' | 'messages' | 'care' | 'alerts' | 'profile';

interface BottomNavProps {
  active?: NavKey;
}

const items: Array<{ key: NavKey; label: string; icon: string; url: string }> = [
  { key: 'dashboard', label: '看板', icon: '看', url: '/pages/family/dashboard/index' },
  { key: 'messages', label: '留言', icon: '留', url: '/pages/family/messages/index' },
  { key: 'care', label: '护理', icon: '护', url: '/pages/family/care/index' },
  { key: 'alerts', label: '通知', icon: '通', url: '/pages/family/alerts/index' },
  { key: 'profile', label: '我的', icon: '我', url: '/pages/family/profile/index' },
];

export function BottomNav({ active }: BottomNavProps) {
  return (
    <View className='family-tabbar'>
      {items.map((item) => (
        <View
          key={item.key}
          className={`family-tabbar__item ${item.key === active ? 'family-tabbar__item--active' : ''}`}
          onClick={() => {
            if (item.key !== active) {
              Taro.redirectTo({ url: item.url });
            }
          }}
        >
          <Text className='family-tabbar__icon'>{item.icon}</Text>
          <Text className='family-tabbar__label'>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
