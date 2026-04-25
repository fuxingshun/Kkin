import { useCallback, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import {
  createConsultation,
  getConsultations,
  getCounselors,
  type Consultation,
  type Counselor,
} from '@/services/elderly';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';
import { formatDateTimeText, formatDateTimeValue } from '@/utils/format';
import { getElderlySession } from '@/utils/session';

const methods = [
  { type: 'phone' as const, icon: '电', title: '电话咨询', desc: '方便快捷，随时接听', className: 'ef-method--green' },
  { type: 'video' as const, icon: '视', title: '视频咨询', desc: '面对面交流，更有温度', className: 'ef-method--purple' },
  { type: 'text' as const, icon: '文', title: '文字咨询', desc: '慢慢倾诉，细细聆听', className: 'ef-method--amber' },
];

function getStatusLabel(status: string) {
  if (status === 'scheduled') return '已预约';
  if (status === 'completed') return '已完成';
  if (status === 'cancelled') return '已取消';
  return status;
}

function getTypeLabel(type: string) {
  if (type === 'phone') return '电话咨询';
  if (type === 'video') return '视频咨询';
  if (type === 'text') return '文字咨询';
  return '心理咨询';
}

export default function ElderlyCounselingPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const { familyId, elderlyId } = getElderlySession();
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedType, setSelectedType] = useState<'phone' | 'video' | 'text'>('phone');
  const [booking, setBooking] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [nextCounselors, nextConsultations] = await Promise.all([
        getCounselors(),
        getConsultations(familyId, elderlyId, 20),
      ]);
      setCounselors(nextCounselors);
      setConsultations(nextConsultations);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }, [elderlyId, familyId]);

  useDidShow(() => {
    void loadData();
  });

  async function bookCounselor(counselor?: Counselor) {
    try {
      setBooking(true);
      const scheduled = new Date(Date.now() + 24 * 60 * 60 * 1000);
      scheduled.setHours(19, 0, 0, 0);
      await createConsultation({
        family_id: familyId,
        elderly_id: elderlyId,
        counselor_id: counselor?.id,
        consultation_type: selectedType,
        scheduled_time: formatDateTimeValue(scheduled),
        note: '老人端主动预约',
      });
      Taro.showToast({ title: '预约已提交', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '预约失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setBooking(false);
    }
  }

  const completedConsultations = consultations.filter((item) => item.status === 'completed').length;

  return (
    <View className={`ef-page ef-page--sub ${preferenceClassName}`}>
      <View className='ef-topbar ef-topbar--sticky'>
        <Text className='ef-topbar__back' onClick={() => Taro.redirectTo({ url: '/pages/elderly/home/index' })}>〈</Text>
        <Text className='ef-topbar__title'>心理咨询服务</Text>
      </View>

      <View className='ef-counseling-content'>
        <View className='ef-consult-hero'>
          <View className='ef-consult-hero__top'>
            <View className='ef-consult-icon'>心</View>
            <View>
              <Text className='ef-consult-title'>专业心理咨询服务</Text>
              <Text className='ef-consult-desc'>提供7×24小时专业心理咨询服务，资深咨询师团队随时为您提供支持</Text>
            </View>
          </View>
          <View className='ef-consult-stats'>
            <View><Text>{consultations.length}</Text><Text>咨询次数</Text></View>
            <View><Text>{completedConsultations}</Text><Text>服务完成</Text></View>
            <View><Text>100%</Text><Text>满意度</Text></View>
          </View>
        </View>

        <View className='ef-panel'>
          <Text className='ef-section-title'>选择咨询方式</Text>
          <View className='ef-consult-methods'>
            {methods.map((item) => (
              <Button
                key={item.type}
                className={`ef-method ${item.className} ${selectedType === item.type ? 'ef-method--active' : ''}`}
                onClick={() => setSelectedType(item.type)}
              >
                <Text>{item.icon}</Text>
                <View><Text>{item.title}</Text><Text>{item.desc}</Text></View>
              </Button>
            ))}
          </View>
        </View>

        <View className='ef-panel'>
          <Text className='ef-section-title'>专业咨询师</Text>
          <View className='ef-list'>
            {counselors.length ? (
              counselors.map((item) => (
                <View className='ef-counselor-card' key={item.id}>
                  <View className='ef-counselor-head'>
                    <View className='ef-counselor-avatar'>{item.avatar || item.name.slice(0, 1)}</View>
                    <View className='ef-counselor-body'>
                      <View className='ef-inline'>
                        <Text className='ef-card-title'>{item.name}</Text>
                        {item.available ? <Text className='ef-online-badge'>在线</Text> : null}
                      </View>
                      <Text className='ef-card-text'>{item.title}</Text>
                      <Text className='ef-muted'>从业 {item.experience || '多年'} · 评分 {item.rating || '5.0'}</Text>
                    </View>
                  </View>
                  <View className='ef-specialty'>
                    <Text>擅长领域：{item.specialty || '老年心理、家庭照护'}</Text>
                  </View>
                  <Button className='ef-purple-button' loading={booking} onClick={() => bookCounselor(item)}>立即预约</Button>
                </View>
              ))
            ) : (
              <View className='ef-counselor-card'>
                <Text className='ef-card-title'>暂无咨询师</Text>
                <Text className='ef-card-text'>请先在数据库中维护咨询师信息。</Text>
                <Button className='ef-purple-button' loading={booking} onClick={() => bookCounselor()}>提交预约需求</Button>
              </View>
            )}
          </View>
        </View>

        <View className='ef-panel'>
          <View className='ef-section-head'>
            <Text className='ef-section-title'>咨询记录</Text>
            <Text className='ef-muted'>{consultations.length}条</Text>
          </View>
          <View className='ef-list'>
            {consultations.length ? (
              consultations.map((item) => (
                <View className='ef-history-card' key={item.id}>
                  <View className='ef-history-head'>
                    <View className='ef-history-icon'>✓</View>
                    <View>
                      <View className='ef-inline'>
                        <Text className='ef-card-title'>{getTypeLabel(item.consultation_type)}</Text>
                        <Text className='ef-done-badge'>{getStatusLabel(item.status)}</Text>
                      </View>
                      <Text className='ef-card-text'>咨询师：{item.counselor_name || '待分配'}</Text>
                      <Text className='ef-muted'>{formatDateTimeText(item.scheduled_time)} · {item.duration || 45}分钟</Text>
                    </View>
                  </View>
                  {item.note ? (
                    <View className='ef-specialty'>
                      <Text>{item.note}</Text>
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <View className='ef-history-card'>
                <Text className='ef-card-title'>还没有咨询记录</Text>
                <Text className='ef-card-text'>预约成功后会在这里显示。</Text>
              </View>
            )}
          </View>
        </View>

        <View className='ef-warning-note'>
          <Text className='ef-card-title'>服务说明</Text>
          <Text>· 咨询师严格遵守职业道德，保护您的隐私安全</Text>
          <Text>· 建议在安静舒适的环境中进行咨询，确保通话质量</Text>
          <Text>· 所有咨询记录将自动保存，可随时在个人中心查看</Text>
        </View>
      </View>
    </View>
  );
}
