import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const menuItems = [
  { title: '个人信息', path: '/pages/service/profile/index', icon: '人' },
  { title: '所属机构', path: '/pages/service/workspace/index', icon: '⌂' },
  { title: '设置', path: '/pages/service/profile/index', icon: '⚙' },
  { title: '帮助中心', path: '/pages/service/profile/index', icon: '?' },
];

export default function ServiceProfilePage() {
  return (
    <View className='service-page service-page--figma sp-page'>
      <View className='sp-hero'>
        <View className='sp-avatar'>
          <Text>👨‍⚕️</Text>
        </View>
        <Text className='sp-name'>王医生</Text>
        <Text className='sp-role'>心理咨询师</Text>
      </View>

      <View className='sp-menu'>
        {menuItems.map((item) => (
          <View
            className='sp-menu-row'
            key={item.title}
            onClick={() => {
              if (item.path !== '/pages/service/profile/index') {
                Taro.redirectTo({ url: item.path });
              }
            }}
          >
            <View className='sp-menu-row__left'>
              <View className='sp-menu-row__icon'>
                <Text>{item.icon}</Text>
              </View>
              <Text className='sp-menu-row__title'>{item.title}</Text>
            </View>
            <Text className='sp-menu-row__chevron'>›</Text>
          </View>
        ))}
      </View>

      <ServiceTabBar active='profile' />
    </View>
  );
}
