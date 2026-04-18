import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const emotionData = [
  { day: '1', score: 75 },
  { day: '2', score: 70 },
  { day: '3', score: 65 },
  { day: '4', score: 60 },
  { day: '5', score: 65 },
  { day: '6', score: 70 },
  { day: '7', score: 75 },
];

export default function ServiceCaseDetailPage() {
  return (
    <View className='service-page'>
      <View className='service-topbar service-topbar--inline'>
        <Text className='service-link' onClick={() => Taro.redirectTo({ url: '/pages/service/cases/index' })}>
          返回
        </Text>
        <Text className='service-topbar__title'>个案详情</Text>
        <Text className='service-link'>记录</Text>
      </View>

      <View className='service-section'>
        <View className='service-profile-card'>
          <View className='service-profile-card__avatar'>
            <Text>张</Text>
          </View>
          <View className='service-profile-card__body'>
            <View className='service-chip-row'>
              <Text className='service-card-title'>张翠花</Text>
              <Text className='service-chip service-chip--red'>高风险</Text>
            </View>
            <Text className='service-card-meta'>68 岁 · 阳光社区</Text>
          </View>
        </View>
        <View className='service-two-grid'>
          <View className='service-info-box'>
            <Text className='service-card-meta'>家属联系人</Text>
            <Text className='service-card-title'>李晓娟（女儿）</Text>
          </View>
          <View className='service-info-box'>
            <Text className='service-card-meta'>联系电话</Text>
            <Text className='service-card-title'>138****5678</Text>
          </View>
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>近 7 天情绪趋势</Text>
        <View className='service-chart'>
          {emotionData.map((item) => (
            <View className='service-chart__item' key={item.day}>
              <View className='service-chart__track'>
                <View className='service-chart__bar' style={{ height: `${item.score}%` }} />
              </View>
              <Text className='service-chart__label'>{item.day}</Text>
            </View>
          ))}
        </View>
        <View className='service-warning'>
          <Text>连续 3 天情绪评分低于 70，建议进行心理干预。</Text>
        </View>
      </View>

      <View className='service-two-grid'>
        <Button className='service-button service-button--primary'>创建服务记录</Button>
        <Button className='service-button service-button--soft'>联系家属</Button>
      </View>

      <ServiceTabBar active='cases' />
    </View>
  );
}
