import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';

type ElderlyNavKey = 'home' | 'companion' | 'memories' | 'consulting' | 'record' | 'profile';

interface ElderlyTabBarProps {
  active: ElderlyNavKey;
}

const elderlyNavItems: Array<{ key: ElderlyNavKey; label: string; icon: string; url: string }> = [
  { key: 'home', label: '首页', icon: '⌂', url: '/pages/elderly/home/index' },
  { key: 'companion', label: '陪伴', icon: '♡', url: '/pages/elderly/companion/index' },
  { key: 'memories', label: '回忆', icon: '▧', url: '/pages/elderly/memories/index' },
  { key: 'consulting', label: '咨询', icon: '人', url: '/pages/elderly/psychological-consulting/index' },
  { key: 'profile', label: '我的', icon: '人', url: '/pages/elderly/profile/index' },
];

export function ElderlyTabBar({ active }: ElderlyTabBarProps) {
  return (
    <View className='elderly-tabbar'>
      {elderlyNavItems.map((item) => (
        <View
          key={item.key}
          className={`elderly-tabbar__item ${item.key === active ? 'elderly-tabbar__item--active' : ''}`}
          onClick={() => {
            if (item.key !== active) {
              Taro.redirectTo({ url: item.url });
            }
          }}
        >
          <Text className='elderly-tabbar__icon'>{item.icon}</Text>
          <Text className='elderly-tabbar__label'>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
