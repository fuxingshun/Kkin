import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';

type ServiceNavKey = 'workspace' | 'consultations' | 'cases' | 'schedule' | 'tasks' | 'followup' | 'profile';

interface ServiceTabBarProps {
  active: ServiceNavKey;
}

const serviceNavItems: Array<{
  key: Extract<ServiceNavKey, 'workspace' | 'consultations' | 'cases' | 'schedule' | 'profile'>;
  label: string;
  icon: string;
  url: string;
}> = [
  { key: 'workspace', label: '工作台', icon: '▦', url: '/pages/service/workspace/index' },
  { key: 'consultations', label: '咨询', icon: '✉', url: '/pages/service/consultations/index' },
  { key: 'cases', label: '个案', icon: '◎', url: '/pages/service/cases/index' },
  { key: 'schedule', label: '日程', icon: '□', url: '/pages/service/schedule/index' },
  { key: 'profile', label: '我的', icon: '人', url: '/pages/service/profile/index' },
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
          <Text className={`service-tabbar__dot ${item.key === active ? 'service-tabbar__dot--active' : ''}`} />
        </View>
      ))}
    </View>
  );
}
