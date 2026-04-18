import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const menuItems = [
  { title: '个人信息', desc: '服务人员资料与执业信息', path: '/pages/service/workspace/index' },
  { title: '重点个案', desc: '查看当前重点老人和风险分层', path: '/pages/service/cases/index' },
  { title: '工单处理', desc: '进入待处理与处理中工单列表', path: '/pages/service/tasks/index' },
  { title: '随访安排', desc: '查看并推进随访计划', path: '/pages/service/followup/index' },
];

export default function ServiceProfilePage() {
  return (
    <View className='service-page'>
      <View className='service-hero service-hero--solid'>
        <View className='service-profile-head'>
          <View className='service-profile-head__avatar'>
            <Text>服</Text>
          </View>
          <View>
            <Text className='service-hero__title'>服务人员中心</Text>
            <Text className='service-hero__subtitle'>把个案、工单和随访统一收口管理</Text>
          </View>
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>工作概况</Text>
        <View className='service-two-grid'>
          <View className='service-info-box'>
            <Text className='service-stat__value'>实时</Text>
            <Text className='service-card-meta'>任务同步</Text>
          </View>
          <View className='service-info-box'>
            <Text className='service-stat__value'>闭环</Text>
            <Text className='service-card-meta'>处理流转</Text>
          </View>
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>工作入口</Text>
        <View className='service-list'>
          {menuItems.map((item) => (
            <View
              className='service-menu-row'
              key={item.title}
              onClick={() => Taro.redirectTo({ url: item.path })}
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
