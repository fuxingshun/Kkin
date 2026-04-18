import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { BottomNav } from '@/components/BottomNav';

const counselors = [
  { name: '王医生', title: '老年心理咨询师', tag: '可预约', tone: 'green' },
  { name: '陈老师', title: '家庭照护指导', tag: '明日可约', tone: 'blue' },
];

const records = [
  { title: '睡眠与焦虑沟通', time: '04月10日 19:30', result: '建议睡前陪伴 10 分钟' },
  { title: '家庭陪伴节奏', time: '04月03日 20:00', result: '建议固定周末视频' },
];

export default function CounselingPage() {
  return (
    <View className='ff-page ff-page--tab'>
      <View className='ff-sub-topbar'>
        <Text className='ff-back' onClick={() => Taro.redirectTo({ url: '/pages/family/dashboard/index' })}>‹</Text>
        <Text className='ff-sub-topbar__title'>预约咨询</Text>
        <Text className='ff-sub-topbar__spacer'> </Text>
      </View>

      <View className='ff-stack ff-stack--page'>
        <View className='ff-counsel-hero'>
          <View>
            <Text className='ff-kicker'>家属支持</Text>
            <Text className='ff-hero__title'>把照护压力说出来</Text>
            <Text className='ff-hero__subtitle'>专业人员会帮助你一起梳理陪伴方式</Text>
          </View>
          <View className='ff-avatar ff-avatar--glass'>咨</View>
        </View>

        <View className='ff-card'>
          <View className='ff-section-head'>
            <View>
              <Text className='ff-section-title'>即将开始</Text>
              <Text className='ff-card-subtitle'>今天 20:00 · 线上语音咨询</Text>
            </View>
            <Text className='ff-chip ff-chip--pink'>已预约</Text>
          </View>
          <Button className='ff-download-button ff-download-button--pink'>进入咨询</Button>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>快速预约</Text>
          <View className='ff-reserve-grid'>
            <Text>今天 20:00</Text>
            <Text>明天 10:30</Text>
            <Text>明天 19:00</Text>
            <Text>周五 15:00</Text>
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>推荐咨询师</Text>
          <View className='ff-list'>
            {counselors.map((item) => (
              <View className='ff-counselor-row' key={item.name}>
                <View className={`ff-menu-row__icon ff-menu-row__icon--${item.tone}`}>{item.name.slice(0, 1)}</View>
                <View className='ff-menu-row__body'>
                  <Text>{item.name}</Text>
                  <Text>{item.title}</Text>
                </View>
                <Text className={`ff-chip ff-chip--${item.tone}`}>{item.tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='ff-card'>
          <Text className='ff-section-title'>咨询记录</Text>
          <View className='ff-list'>
            {records.map((item) => (
              <View className='ff-record-row ff-record-row--simple' key={item.title}>
                <View className='ff-record-row__body'>
                  <Text>{item.title}</Text>
                  <Text>{item.time}</Text>
                  <Text>{item.result}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <BottomNav active='dashboard' />
    </View>
  );
}
