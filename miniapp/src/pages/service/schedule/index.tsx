import { Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const weekDays = [
  { day: '一', date: '4/21' },
  { day: '二', date: '4/22' },
  { day: '三', date: '4/23' },
  { day: '四', date: '4/24' },
  { day: '五', date: '4/25', active: true },
  { day: '六', date: '4/26' },
  { day: '日', date: '4/27' },
];

const schedules = [
  { time: '09:00', name: '张翠花', topic: '焦虑情绪疏导', type: '视频咨询', icon: '▣', duration: '45分钟' },
  { time: '14:30', name: '李秀英', topic: '家庭关系沟通', type: '电话咨询', icon: '☎', duration: '30分钟' },
  { time: '16:00', name: '王大爷', topic: '孤独感陪伴', type: '视频咨询', icon: '▣', duration: '45分钟' },
];

const slots = [
  { time: '08:30', disabled: false },
  { time: '09:00', disabled: true },
  { time: '10:00', disabled: false },
  { time: '11:00', disabled: false },
  { time: '14:00', disabled: false },
  { time: '14:30', disabled: true },
  { time: '15:00', disabled: false },
  { time: '16:00', disabled: true },
  { time: '17:00', disabled: false },
  { time: '19:00', disabled: false },
];

export default function ServiceSchedulePage() {
  return (
    <View className='service-page service-page--figma ss-page'>
      <View className='ss-header'>
        <Text className='ss-title'>咨询日程</Text>
        <View className='ss-week-nav'>
          <Text>‹</Text>
          <Text>2026年4月</Text>
          <Text>›</Text>
        </View>
      </View>

      <View className='ss-week-strip'>
        {weekDays.map((item) => (
          <View className={`ss-day ${item.active ? 'ss-day--active' : ''}`} key={item.date}>
            <Text className='ss-day__name'>{item.day}</Text>
            <Text className='ss-day__date'>{item.date}</Text>
          </View>
        ))}
      </View>

      <View className='ss-add-btn'>
        <Text>添加咨询安排</Text>
      </View>

      <View className='ss-card'>
        <Text className='ss-card__title'>今日安排</Text>
        <View className='ss-timeline'>
          {schedules.map((item) => (
            <View className='ss-timeline-item' key={`${item.time}-${item.name}`}>
              <View className='ss-time'>
                <Text>{item.time}</Text>
              </View>
              <View className='ss-schedule-card'>
                <View className='ss-schedule-card__head'>
                  <View>
                    <Text className='ss-schedule-card__name'>{item.name}</Text>
                    <Text className='ss-schedule-card__topic'>{item.topic}</Text>
                  </View>
                  <Text className='ss-duration'>{item.duration}</Text>
                </View>
                <View className='ss-schedule-card__foot'>
                  <Text className='ss-consult-type'>{item.icon} {item.type}</Text>
                  <Text className='ss-enter'>进入咨询室</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className='ss-card'>
        <Text className='ss-card__title'>可预约时间</Text>
        <View className='ss-slot-grid'>
          {slots.map((slot) => (
            <Text className={`ss-slot ${slot.disabled ? 'ss-slot--disabled' : ''}`} key={slot.time}>
              {slot.time}
            </Text>
          ))}
        </View>
      </View>

      <View className='ss-stats-card'>
        <View>
          <Text className='ss-stat-value'>12</Text>
          <Text className='ss-stat-label'>本周咨询</Text>
        </View>
        <View>
          <Text className='ss-stat-value'>9</Text>
          <Text className='ss-stat-label'>已完成</Text>
        </View>
        <View>
          <Text className='ss-stat-value'>3</Text>
          <Text className='ss-stat-label'>待进行</Text>
        </View>
      </View>

      <ServiceTabBar active='schedule' />
    </View>
  );
}
