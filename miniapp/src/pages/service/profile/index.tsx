import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const menuItems = [
  { title: '个人信息', desc: '王医生，心理咨询师' },
  { title: '所属机构', desc: '阳光社区心理服务站' },
  { title: '设置', desc: '通知、排班和工作偏好' },
  { title: '帮助中心', desc: '服务流程与平台支持' },
];

export default function ServiceProfilePage() {
  return (
    <View className='service-page'>
      <View className='service-hero service-hero--solid'>
        <View className='service-profile-head'>
          <View className='service-profile-head__avatar'>
            <Text>王</Text>
          </View>
          <View>
            <Text className='service-hero__title'>王医生</Text>
            <Text className='service-hero__subtitle'>心理咨询师</Text>
          </View>
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>工作概况</Text>
        <View className='service-two-grid'>
          <View className='service-info-box'>
            <Text className='service-stat__value'>32</Text>
            <Text className='service-card-meta'>服务个案</Text>
          </View>
          <View className='service-info-box'>
            <Text className='service-stat__value'>96%</Text>
            <Text className='service-card-meta'>按时完成</Text>
          </View>
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>账户设置</Text>
        <View className='service-list'>
          {menuItems.map((item) => (
            <View
              className='service-menu-row'
              key={item.title}
              onClick={() => Taro.showToast({ title: '功能完善中', icon: 'none' })}
            >
              <View>
                <Text className='service-card-title'>{item.title}</Text>
                <Text className='service-card-text'>{item.desc}</Text>
              </View>
              <Text className='service-link'>进入</Text>
            </View>
          ))}
        </View>
      </View>

      <ServiceTabBar active='profile' />
    </View>
  );
}
