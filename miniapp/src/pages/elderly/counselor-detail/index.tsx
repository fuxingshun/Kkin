import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import {
  createConsultation,
  getCounselors,
  type Consultation,
  type Counselor,
} from '@/services/elderly';
import { formatDateTimeValue } from '@/utils/format';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';

const tabs = [
  { id: 'intro', label: '个人简介' },
  { id: 'packages', label: '咨询方案' },
  { id: 'schedule', label: '可约时间' },
  { id: 'articles', label: '专栏' },
] as const;

function getCounselorId() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const value = Number(params.id || 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function buildScheduledTime() {
  return formatDateTimeValue(new Date(Date.now() + 60 * 60 * 1000));
}

function splitSpecialty(value?: string) {
  return String(value || '')
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ElderlyCounselorDetailPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const [selectedTab, setSelectedTab] = useState<(typeof tabs)[number]['id']>('intro');
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const counselorId = getCounselorId();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const nextCounselors = await getCounselors();
      setCounselors(nextCounselors);
    } catch (error) {
      const message = error instanceof Error ? error.message : '咨询师详情加载失败';
      Taro.showToast({ title: message, icon: 'none' });
      setCounselors([]);
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  usePullDownRefresh(() => {
    void loadData();
  });

  const counselor = useMemo(
    () => counselors.find((item) => item.id === counselorId) || null,
    [counselorId, counselors]
  );

  const stats = counselor?.experience_stats || {};
  const tags = Array.isArray(counselor?.tags) ? counselor.tags : [];
  const specialties = Array.isArray(counselor?.specialties) && counselor.specialties.length
    ? counselor.specialties
    : counselor?.specialty
      ? [{ title: '擅长领域', items: splitSpecialty(counselor.specialty) }]
      : [];
  const packages = Array.isArray(counselor?.packages) ? counselor.packages : [];
  const calendar = counselor?.calendar || {};
  const calendarDates = Array.isArray(calendar.dates) ? calendar.dates : [];
  const notices = Array.isArray(counselor?.notices) ? counselor.notices : [];
  const price = counselor?.price ?? 0;
  const discountPrice = counselor?.discount_price ?? price;
  const canBook = counselor?.available ?? false;

  async function bookCounselor(consultationType: Consultation['consultation_type'] = 'video') {
    if (!counselor) {
      Taro.showToast({ title: '咨询师信息仍在加载', icon: 'none' });
      return;
    }
    if (!canBook) {
      Taro.showToast({ title: '该咨询师当前不可预约', icon: 'none' });
      return;
    }
    try {
      setBooking(true);
      await createConsultation({
        counselor_id: counselor.id,
        consultation_type: consultationType === 'phone' ? 'phone' : 'video',
        scheduled_time: buildScheduledTime(),
        duration: 45,
        notify_service: true,
        concern_level: 'medium',
        topic: counselor.specialty || specialties.map((item) => item.title).join('、') || '心理咨询预约',
        note: `老人端预约：${counselor.name}`,
      });
      Taro.showToast({ title: '预约已提交', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '预约失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setBooking(false);
    }
  }

  return (
    <View className={`pc-page cd-page ${preferenceClassName}`}>
      <View className='cd-topbar'>
        <Text className='cd-topbar__back' onClick={() => Taro.navigateBack()}>‹</Text>
        <Text className='cd-topbar__title'>
          {counselor ? `${counselor.name}心理咨询师-壹心理` : loading ? '咨询师详情' : '未找到咨询师'}
        </Text>
        <View className='cd-topbar__actions'>
          <Text>···</Text>
          <Text>－</Text>
          <Text>○</Text>
        </View>
      </View>

      <View className='cd-content'>
        <View className='cd-hero'>
          <Text className='cd-hero__avatar'>{counselor?.hero_emoji || counselor?.avatar || '咨'}</Text>
          <View className='cd-hero__count'>
            <Text>1/2</Text>
          </View>
          <View className='cd-hero__hint'>
            <Text className='cd-hero__dot' />
            <Text>{counselor?.hero_hint || '正在同步咨询师资料'}</Text>
          </View>
          <View className='cd-hero__card-button'>
            <Text>名片</Text>
          </View>
        </View>

        <View className='cd-card cd-profile-card'>
          <View className='cd-profile-card__head'>
            <View className='cd-profile-card__name-row'>
              <Text className='cd-name'>{counselor?.name || (loading ? '加载中' : '未找到')}</Text>
              <View className='cd-verified'>
                <Text>✓</Text>
              </View>
              <Text className='cd-badge cd-badge--blue'>{canBook ? '执业' : '暂不可约'}</Text>
              {counselor?.title ? <Text className='cd-badge cd-badge--purple'>{counselor.title}</Text> : null}
            </View>
            <View className='cd-price'>
              <Text className='cd-price__num'>{price ? `¥${price}` : '--'}</Text>
              <Text className='cd-price__unit'>/次</Text>
            </View>
          </View>

          {counselor?.education ? <Text className='cd-education'>{counselor.education}</Text> : null}
          {tags.length ? (
            <View className='cd-tag-row'>
              {tags.map((tag) => (
                <Text className='cd-outline-tag' key={tag}>{tag}</Text>
              ))}
            </View>
          ) : null}
        </View>

        <View className='cd-card'>
          <Text className='cd-section-title'>咨询经验</Text>
          <View className='cd-stat-grid'>
            <View className='cd-stat'>
              <Text className='cd-stat__value'>{stats.hours || '--'}</Text>
              <Text className='cd-stat__label'>小时</Text>
              <Text className='cd-stat__label'>服务时长</Text>
            </View>
            <View className='cd-stat'>
              <Text className='cd-stat__value'>{stats.years || counselor?.experience || '--'}</Text>
              <Text className='cd-stat__label'>从业年限</Text>
            </View>
            <View className='cd-stat'>
              <Text className='cd-stat__value'>{stats.training || '--'}</Text>
              <Text className='cd-stat__label'>培训经历</Text>
            </View>
            <View className='cd-stat'>
              <Text className='cd-stat__value'>{stats.supervision || '--'}</Text>
              <Text className='cd-stat__label'>小时</Text>
              <Text className='cd-stat__label'>个体督导</Text>
            </View>
          </View>

          <View className='cd-meta-row'>
            {counselor?.availability_text ? <Text>{counselor.availability_text}</Text> : null}
            {counselor?.format_text ? <Text>▣ {counselor.format_text}</Text> : null}
            {counselor?.location ? <Text>⌖ {counselor.location}</Text> : null}
          </View>

          <View className='cd-soft-tag-row'>
            {['无忧保障', '24h前免费取消', '拒单补偿', '1v1匹配咨询师'].map((item) => (
              <Text className='cd-soft-tag' key={item}>{item}</Text>
            ))}
          </View>
        </View>

        <View className='cd-tabs'>
          {tabs.map((tab) => (
            <View
              key={tab.id}
              className={`cd-tab ${selectedTab === tab.id ? 'cd-tab--active' : ''}`}
              onClick={() => setSelectedTab(tab.id)}
            >
              <Text>{tab.label}</Text>
            </View>
          ))}
        </View>

        <View className='cd-card'>
          <Text className='cd-section-title'>擅长领域</Text>
          {specialties.length ? (
            <View className='cd-specialty-list'>
              {specialties.map((specialty) => (
                <View className='cd-specialty' key={specialty.title}>
                  <Text className='cd-specialty__title'>{specialty.title}</Text>
                  {specialty.items?.length ? (
                    <View className='cd-specialty__items'>
                      {specialty.items.map((item, index) => (
                        <Text key={item} className='cd-specialty__item'>
                          {item}{index < (specialty.items?.length || 0) - 1 ? '、' : ''}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text className='cd-section-desc'>暂无擅长领域信息</Text>
          )}
          <Text className='cd-link'>展开全部简介</Text>
        </View>

        <View className='cd-card'>
          <Text className='cd-section-title'>咨询方案</Text>
          {packages.length ? (
            <View className='cd-package-list'>
              {packages.map((item) => (
                <View className='cd-package' key={item.id || item.name}>
                  {item.label ? <Text className='cd-package__label'>{item.label}</Text> : null}
                  <View className='cd-package__main'>
                    <View className='cd-package__body'>
                      <View className='cd-package__title-row'>
                        <Text className='cd-package__title'>{item.name}</Text>
                        <Text className='cd-package__price'>¥{item.price}</Text>
                        <Text className='cd-package__unit'>/次</Text>
                      </View>
                      {item.description ? <Text className='cd-package__desc'>{item.description}</Text> : null}
                      {item.label ? <Text className='cd-package__link'>查看套餐详情 ›</Text> : null}
                    </View>
                    <Button className='cd-package__button' loading={booking} onClick={() => void bookCounselor('video')}>
                      去预约
                    </Button>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text className='cd-section-desc'>暂无可预约方案</Text>
          )}
        </View>

        <View className='cd-card'>
          <Text className='cd-section-title'>可约时间（北京时间）</Text>
          <Text className='cd-section-desc'>选择咨询师已开放的咨询时间，预约成功率更高哦~</Text>
          <Text className='cd-calendar-month'>{calendar.month || '--'}</Text>

          <View className='cd-week-row'>
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
              <Text key={day}>{day}</Text>
            ))}
          </View>
          {calendarDates.length ? (
            <View className='cd-calendar-grid'>
              {calendarDates.map((date, index) => (
                <View
                  key={`${date.day}-${index}`}
                  className={`cd-date ${date.isToday ? 'cd-date--today' : ''}`}
                >
                  <Text className='cd-date__day'>{date.day}</Text>
                  {date.status === 'full' ? (
                    <Text className='cd-date__status'>满</Text>
                  ) : date.available ? (
                    <Text className='cd-date__status cd-date__status--available'>剩{date.available}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text className='cd-section-desc'>暂无可约时间</Text>
          )}
        </View>

        <View className='cd-card cd-notice-card'>
          <Text className='cd-notice-title'>预约须知</Text>
          {notices.length ? (
            <View className='cd-notice-list'>
              {notices.map((item) => (
                <View className='cd-notice' key={item.title}>
                  <View className='cd-notice__mark' />
                  <View className='cd-notice__body'>
                    <Text className='cd-notice__heading'>{item.title}</Text>
                    <Text className='cd-notice__text'>{item.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text className='cd-section-desc'>暂无预约须知</Text>
          )}
        </View>
      </View>

      <View className='cd-bottom-bar'>
        <View className='cd-follow'>
          <Text className='cd-follow__icon'>人</Text>
          <Text>已关注</Text>
        </View>
        <Button className='cd-assistant-button' onClick={() => Taro.navigateTo({ url: '/pages/elderly/companion/index' })}>
          先找助理聊聊
          <Text className='cd-red-dot' />
        </Button>
        <Button className='cd-book-button' loading={booking} onClick={() => void bookCounselor('video')}>
          {discountPrice ? <Text className='cd-discount'>低至{discountPrice}元/次</Text> : null}
          立即预约
        </Button>
      </View>
    </View>
  );
}
