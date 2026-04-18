import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';

type ServiceNavKey = 'workspace' | 'cases' | 'tasks' | 'followup' | 'profile';

interface ServiceTabBarProps {
  active: ServiceNavKey;
}

const serviceNavItems: Array<{ key: ServiceNavKey; label: string; icon: string; url: string }> = [
  { key: 'workspace', label: '工作台', icon: '工', url: '/pages/service/workspace/index' },
  { key: 'cases', label: '个案', icon: '案', url: '/pages/service/cases/index' },
  { key: 'tasks', label: '工单', icon: '单', url: '/pages/service/tasks/index' },
  { key: 'followup', label: '随访', icon: '访', url: '/pages/service/followup/index' },
  { key: 'profile', label: '我的', icon: '我', url: '/pages/service/profile/index' },
];

export function ServiceTabBar({ active }: ServiceTabBarProps) {
  return (
    <View className='service-tabbar'>
      {serviceNavItems.map((item) => (
        <View
          key={item.key}
          className={`service-tabbar__item ${item.key === active ? 'service-tabbar__item--active' : ''}`}
          onClick={() => {
            if (item.key !== active) {
              Taro.redirectTo({ url: item.url });
            }
          }}
        >
          <Text className='service-tabbar__icon'>{item.icon}</Text>
          <Text className='service-tabbar__label'>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
