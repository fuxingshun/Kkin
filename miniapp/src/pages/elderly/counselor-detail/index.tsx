import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { AppIcon } from '@/components/AppIcon';
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

type DetailTab = (typeof tabs)[number]['id'];
type CalendarDate = NonNullable<NonNullable<Counselor['calendar']>['dates']>[number];

function getCounselorId() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const value = Number(params.id || 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function parseCalendarMonth(month?: string) {
  const match = String(month || '').match(/(\d{4})年(\d{1,2})月/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
  };
}

function buildScheduledTime(calendarMonth?: string, date?: CalendarDate) {
  const parsedMonth = parseCalendarMonth(calendarMonth);
  const day = Number(date?.day);
  if (parsedMonth && Number.isFinite(day) && day > 0) {
    const selected = new Date(parsedMonth.year, parsedMonth.monthIndex, day, 19, 0, 0, 0);
    if (selected.getTime() > Date.now()) {
      return formatDateTimeValue(selected);
    }
  }
  return formatDateTimeValue(new Date(Date.now() + 60 * 60 * 1000));
}

function splitSpecialty(value?: string) {
  return String(value || '')
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPrimarySpecialty(counselor: Counselor | null) {
  if (!counselor) return '心理支持';
  return counselor.specialty || counselor.specialties?.map((item) => item.title).join('、') || '心理支持';
}

export default function ElderlyCounselorDetailPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const [selectedTab, setSelectedTab] = useState<DetailTab>('intro');
  const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
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
  const firstAvailableIndex = calendarDates.findIndex((date) => Boolean(date.available));
  const selectedDate = selectedDateIndex !== null ? calendarDates[selectedDateIndex] : calendarDates[firstAvailableIndex];
  const price = counselor?.price ?? 0;
  const canBook = counselor?.available ?? false;
  const primarySpecialty = getPrimarySpecialty(counselor);
  const articleTopics = specialties.flatMap((item) => item.items?.slice(0, 2) || [item.title]).slice(0, 4);

  function selectTab(tab: DetailTab) {
    setSelectedTab(tab);
    void Taro.pageScrollTo({
      selector: `#cd-section-${tab}`,
      duration: 180,
    });
  }

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
        scheduled_time: buildScheduledTime(calendar.month, selectedDate),
        duration: 45,
        notify_service: true,
        concern_level: 'medium',
        topic: primarySpecialty || '心理咨询预约',
        note: `老人端预约：${counselor.name}${selectedDate?.day ? `，意向日期：${calendar.month || ''}${selectedDate.day}日` : ''}`,
      });
      Taro.showToast({ title: '预约已提交', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '预约失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setBooking(false);
    }
  }

  function openArticle(topic: string) {
    const query = [
      `topic=${encodeURIComponent(topic)}`,
      `name=${encodeURIComponent(counselor?.name || '咨询师')}`,
      `title=${encodeURIComponent(counselor?.title || '')}`,
      `specialty=${encodeURIComponent(primarySpecialty || topic)}`,
      `id=${counselor?.id || counselorId}`,
    ].join('&');

    void Taro.navigateTo({
      url: `/pages/elderly/counselor-article/index?${query}`,
    });
  }

  return (
    <View className={`pc-page cd-page ${preferenceClassName}`}>
      <View className='cd-topbar'>
        <View className='cd-topbar__back' onClick={() => Taro.navigateBack()}>
          <AppIcon name='chevron-left' />
        </View>
        <Text className='cd-topbar__title'>
          {counselor ? `${counselor.name} · ${counselor.title}` : loading ? '咨询师详情' : '未找到咨询师'}
        </Text>
        <View className='cd-topbar__actions'>
          <View className='cd-topbar__icon-button' onClick={() => void loadData()}>
            <AppIcon name='refresh' />
          </View>
          <View
            className='cd-topbar__icon-button'
            onClick={() => Taro.showToast({ title: '可使用右上角分享给家属', icon: 'none' })}
          >
            <AppIcon name='share' />
          </View>
        </View>
      </View>

      <View className='cd-content'>
        <View className='cd-card cd-profile-card'>
          <View className='cd-profile-card__head'>
            <View className='cd-profile-card__name-row'>
              <Text className='cd-name'>{counselor?.name || (loading ? '加载中' : '未找到')}</Text>
              <View className='cd-verified'>
                <AppIcon name='check' />
              </View>
              <Text className='cd-badge cd-badge--blue'>{canBook ? '执业认证' : '暂不可约'}</Text>
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
              <Text className='cd-stat__label'>督导时长</Text>
            </View>
          </View>

          <View className='cd-soft-tag-row'>
            {['无忧保障', '24h前免费取消', '服务端协同', '1v1匹配咨询师'].map((item) => (
              <Text className='cd-soft-tag' key={item}>{item}</Text>
            ))}
          </View>
        </View>

        <View className='cd-tabs'>
          {tabs.map((tab) => (
            <View
              key={tab.id}
              className={`cd-tab ${selectedTab === tab.id ? 'cd-tab--active' : ''}`}
              onClick={() => selectTab(tab.id)}
            >
              <Text>{tab.label}</Text>
            </View>
          ))}
        </View>

        <View id='cd-section-intro' className='cd-card'>
          <Text className='cd-section-title'>擅长领域</Text>
          {specialties.length ? (
            <View className='cd-specialty-list'>
              {specialties.map((specialty) => (
                <View className='cd-specialty' key={specialty.title}>
                  <View className='cd-specialty__head'>
                    <AppIcon name='heart' />
                    <Text className='cd-specialty__title'>{specialty.title}</Text>
                  </View>
                  {specialty.items?.length ? (
                    <View className='cd-specialty__items'>
                      {specialty.items.map((item) => (
                        <Text key={item} className='cd-specialty__item'>{item}</Text>
                      ))}
                    </View>
                  ) : (
                    <Text className='cd-section-desc cd-section-desc--plain'>咨询师会结合首次访谈继续细化支持方向。</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text className='cd-section-desc'>暂无擅长领域信息</Text>
          )}
        </View>

        <View id='cd-section-packages' className='cd-card'>
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
                      {selectedDate?.day ? (
                        <Text className='cd-package__link'>意向时间：{calendar.month || ''}{selectedDate.day}日 19:00</Text>
                      ) : (
                        <Text className='cd-package__link'>选择可约日期后成功率更高</Text>
                      )}
                    </View>
                    <Button
                      className='cd-package__button'
                      disabled={!canBook}
                      loading={booking}
                      onClick={() => void bookCounselor('video')}
                    >
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

        <View id='cd-section-schedule' className='cd-card'>
          <Text className='cd-section-title'>可约时间（北京时间）</Text>
          <Text className='cd-section-desc'>选择咨询师已开放的咨询时间，预约将同步到家属端和服务端。</Text>
          <Text className='cd-calendar-month'>{calendar.month || '--'}</Text>

          <View className='cd-week-row'>
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
              <Text key={day}>{day}</Text>
            ))}
          </View>
          {calendarDates.length ? (
            <View className='cd-calendar-grid'>
              {calendarDates.map((date, index) => {
                const isSelected = selectedDateIndex === index || (selectedDateIndex === null && firstAvailableIndex === index);
                return (
                  <View
                    key={`${date.day}-${index}`}
                    className={`cd-date ${date.isToday ? 'cd-date--today' : ''} ${date.available ? 'cd-date--available' : 'cd-date--disabled'} ${isSelected ? 'cd-date--selected' : ''}`}
                    onClick={() => {
                      if (date.available) setSelectedDateIndex(index);
                    }}
                  >
                    <Text className='cd-date__day'>{date.day}</Text>
                    {date.status === 'full' ? (
                      <Text className='cd-date__status'>满</Text>
                    ) : date.available ? (
                      <Text className='cd-date__status cd-date__status--available'>剩{date.available}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text className='cd-section-desc'>暂无可约时间</Text>
          )}
        </View>

        <View id='cd-section-articles' className='cd-card'>
          <Text className='cd-section-title'>咨询师专栏</Text>
          <View className='cd-article-list'>
            {(articleTopics.length ? articleTopics : ['情绪照护', '家庭沟通']).map((topic) => (
              <View className='cd-article' hoverClass='cd-article--hover' key={topic} onClick={() => openArticle(topic)}>
                <View className='cd-article__icon'>
                  <AppIcon name='book' />
                </View>
                <View className='cd-article__body'>
                  <Text className='cd-article__title'>给长辈看的{topic}小科普</Text>
                  <Text className='cd-article__meta'>{counselor?.name || '咨询师'} · 老人端心理科普</Text>
                </View>
                <AppIcon name='chevron-right' className='cd-chevron' />
              </View>
            ))}
          </View>
        </View>

        <View className='cd-card cd-notice-card'>
          <Text className='cd-notice-title'>预约须知</Text>
          {notices.length ? (
            <View className='cd-notice-list'>
              {notices.map((item) => (
                <View className='cd-notice' key={item.title}>
                  <View className='cd-notice__mark'>
                    <AppIcon name='check' />
                  </View>
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
        <View className='cd-follow' onClick={() => setIsFollowing((value) => !value)}>
          <AppIcon name={isFollowing ? 'check' : 'heart'} className='cd-follow__icon' />
          <Text>{isFollowing ? '已关注' : '关注'}</Text>
        </View>
        <Button className='cd-book-button' disabled={!canBook} loading={booking} onClick={() => void bookCounselor('video')}>
          立即预约
        </Button>
      </View>
    </View>
  );
}
