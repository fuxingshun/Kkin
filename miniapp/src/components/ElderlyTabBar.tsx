import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { AppIcon, type AppIconName } from '@/components/AppIcon';

type ElderlyNavKey = 'home' | 'companion' | 'memories' | 'consulting' | 'record' | 'profile';

interface ElderlyTabBarProps {
  active: ElderlyNavKey;
}

const elderlyNavItems: Array<{ key: ElderlyNavKey; label: string; icon: AppIconName; url: string }> = [
  { key: 'home', label: '首页', icon: 'home', url: '/pages/elderly/home/index' },
  { key: 'companion', label: '陪伴', icon: 'heart', url: '/pages/elderly/companion/index' },
  { key: 'memories', label: '回忆', icon: 'image', url: '/pages/elderly/memories/index' },
  { key: 'consulting', label: '咨询', icon: 'message', url: '/pages/elderly/psychological-consulting/index' },
  { key: 'profile', label: '我的', icon: 'user', url: '/pages/elderly/profile/index' },
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
          <AppIcon name={item.icon} className='elderly-tabbar__icon' />
          <Text className='elderly-tabbar__label'>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
