import { Button, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const followups = [
  { time: '09:00', elder: '赵大爷', type: '电话随访' },
  { time: '10:30', elder: '钱奶奶', type: '上门探访' },
  { time: '14:00', elder: '孙阿姨', type: '电话随访' },
  { time: '15:30', elder: '周婆婆', type: '心理评估' },
];

export default function ServiceFollowupPage() {
  return (
    <View className='service-page'>
      <View className='service-hero service-hero--solid'>
        <View className='service-section__head'>
          <View>
            <Text className='service-kicker'>随访计划</Text>
            <Text className='service-hero__title'>今天按时间跟进</Text>
          </View>
          <Button className='service-hero-button'>新建</Button>
        </View>
        <View className='service-stat-grid service-stat-grid--two'>
          <View className='service-stat service-stat--glass'>
            <Text className='service-stat__value'>5</Text>
            <Text className='service-stat__label'>今日随访</Text>
          </View>
          <View className='service-stat service-stat--glass'>
            <Text className='service-stat__value'>12</Text>
            <Text className='service-stat__label'>本周随访</Text>
          </View>
        </View>
      </View>

      <View className='service-section'>
        <Text className='service-section__title'>今日随访任务</Text>
        <View className='service-list'>
          {followups.map((item) => (
            <View className='service-follow-card' key={`${item.time}-${item.elder}`}>
              <View className='service-follow-card__head'>
                <Text className='service-follow-row__time'>{item.time}</Text>
                <Text className='service-card-title'>{item.elder}</Text>
                <Text className='service-chip'>{item.type}</Text>
              </View>
              <Button className='service-button service-button--primary'>开始随访</Button>
            </View>
          ))}
        </View>
      </View>

      <ServiceTabBar active='followup' />
    </View>
  );
}
