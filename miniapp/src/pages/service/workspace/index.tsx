import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { ServiceTabBar } from '@/components/ServiceTabBar';

const taskCards = [
  { type: '紧急干预', name: '张翠花', reason: '连续 3 天情绪低落', priority: 'high' },
  { type: '电话回访', name: '李秀英', reason: '定期心理随访', priority: 'medium' },
];

const riskCases = [
  { id: 1, name: '张翠花', age: 68, risk: '高', lastContact: '2 天前' },
  { id: 2, name: '李秀英', age: 72, risk: '中', lastContact: '5 天前' },
];

const followups = [
  { time: '09:00', name: '赵大爷', type: '电话随访' },
  { time: '10:30', name: '钱奶奶', type: '上门探访' },
  { time: '14:00', name: '孙阿姨', type: '电话随访' },
];

export default function ServiceWorkspacePage() {
  return (
    <View className='service-page'>
      <View className='service-hero'>
        <View className='service-hero__top'>
          <View>
            <Text className='service-kicker'>心理咨询师</Text>
            <Text className='service-hero__title'>王医生的工作台</Text>
            <Text className='service-hero__subtitle'>高风险个案、工单和随访安排都在这里。</Text>
          </View>
          <View className='service-avatar'>
            <Text>医</Text>
          </View>
        </View>
        <View className='service-stat-grid'>
          <View className='service-stat service-stat--glass'>
            <Text className='service-stat__value'>8</Text>
            <Text className='service-stat__label'>待处理工单</Text>
          </View>
          <View className='service-stat service-stat--glass'>
            <Text className='service-stat__value'>3</Text>
            <Text className='service-stat__label'>高风险老人</Text>
          </View>
          <View className='service-stat service-stat--glass'>
            <Text className='service-stat__value'>5</Text>
            <Text className='service-stat__label'>今日随访</Text>
          </View>
        </View>
      </View>

      <View className='service-section service-section--lift'>
        <View className='service-section__head'>
          <Text className='service-section__title'>今日待处理工单</Text>
          <Text className='service-link' onClick={() => Taro.redirectTo({ url: '/pages/service/tasks/index' })}>
            查看全部
          </Text>
        </View>
        <View className='service-list'>
          {taskCards.map((task) => (
            <View
              key={`${task.type}-${task.name}`}
              className={`service-ticket ${task.priority === 'high' ? 'service-ticket--high' : ''}`}
            >
              <View className='service-chip-row'>
                <Text className={`service-chip ${task.priority === 'high' ? 'service-chip--red' : 'service-chip--amber'}`}>
                  {task.type}
                </Text>
                <Text className='service-ticket__name'>{task.name}</Text>
              </View>
              <Text className='service-card-text'>{task.reason}</Text>
              <Button className='service-button service-button--primary'>立即处理</Button>
            </View>
          ))}
        </View>
      </View>

      <View className='service-section'>
        <View className='service-section__head'>
          <Text className='service-section__title'>高风险老人</Text>
          <Text className='service-link' onClick={() => Taro.redirectTo({ url: '/pages/service/cases/index' })}>
            查看全部
          </Text>
        </View>
        <View className='service-list'>
          {riskCases.map((item) => (
            <View className='service-case-row' key={item.name} onClick={() => Taro.navigateTo({ url: `/pages/service/case-detail/index?id=${item.id}` })}>
              <View className='service-case-row__avatar'>
                <Text>{item.name.slice(0, 1)}</Text>
              </View>
              <View className='service-case-row__body'>
                <Text className='service-card-title'>{item.name} · {item.age} 岁</Text>
                <Text className='service-card-meta'>最近联系：{item.lastContact}</Text>
              </View>
              <Text className={`service-chip ${item.risk === '高' ? 'service-chip--red' : 'service-chip--amber'}`}>
                {item.risk}风险
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className='service-section'>
        <View className='service-section__head'>
          <Text className='service-section__title'>今日随访任务</Text>
          <Text className='service-section__desc'>5 个任务</Text>
        </View>
        <View className='service-list'>
          {followups.map((item) => (
            <View className='service-follow-row' key={`${item.time}-${item.name}`}>
              <Text className='service-follow-row__time'>{item.time}</Text>
              <View className='service-follow-row__body'>
                <Text className='service-card-title'>{item.name}</Text>
                <Text className='service-card-meta'>{item.type}</Text>
              </View>
              <Button className='service-mini-button'>开始</Button>
            </View>
          ))}
        </View>
      </View>

      <View className='service-action-grid'>
        <View className='service-action-tile' onClick={() => Taro.redirectTo({ url: '/pages/service/cases/index' })}>
          <Text>查看个案</Text>
        </View>
        <View className='service-action-tile' onClick={() => Taro.redirectTo({ url: '/pages/service/followup/index' })}>
          <Text>创建随访</Text>
        </View>
        <View className='service-action-tile' onClick={() => Taro.redirectTo({ url: '/pages/service/tasks/index' })}>
          <Text>处理工单</Text>
        </View>
      </View>

      <ServiceTabBar active='workspace' />
    </View>
  );
}
