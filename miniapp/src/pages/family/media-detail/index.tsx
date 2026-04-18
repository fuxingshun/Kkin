import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { Button, Image, Input, Picker, Text, Textarea, View } from '@tarojs/components';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import {
  deleteMedia,
  getMediaDetail,
  getMediaUrl,
  getThumbnailUrl,
  mediaCooldownOptions,
  mediaOccasionOptions,
  mediaPriorityOptions,
  mediaTimeWindowOptions,
  moodLabelMap,
  updateMedia,
  type MediaDetail,
  type MediaHistoryEntry,
  type MoodType,
} from '@/services/family';
import { formatDateTimeText, formatDurationSeconds } from '@/utils/format';

function getHistoryFeedbackChip(item: MediaHistoryEntry) {
  if (item.feedback_type === 'like') {
    return '喜欢';
  }

  if (item.feedback_type === 'dislike') {
    return '不喜欢';
  }

  return '未反馈';
}

function parseMediaId() {
  const mediaId = Number(Taro.getCurrentInstance().router?.params?.mediaId);
  return Number.isFinite(mediaId) ? mediaId : null;
}

export default function FamilyMediaDetailPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [timeWindows, setTimeWindows] = useState<string[]>([]);
  const [moods, setMoods] = useState<MoodType[]>([]);
  const [occasion, setOccasion] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [priority, setPriority] = useState(5);

  const mediaId = useMemo(() => parseMediaId(), []);

  const loadData = useCallback(async () => {
    if (!mediaId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getMediaDetail(mediaId);
      setDetail(data);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setTags(data.tags || []);
      setTimeWindows(data.time_windows || []);
      setMoods((data.moods || []) as MoodType[]);
      setOccasion(data.occasions?.[0] || '');
      setCooldown(data.cooldown || 60);
      setPriority(data.priority || 5);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, [mediaId]);

  useDidShow(() => {
    void loadData();
  });

  usePullDownRefresh(() => {
    void loadData();
  });

  function handleAddTag() {
    const nextTag = newTag.trim();

    if (!nextTag) {
      return;
    }

    if (tags.includes(nextTag)) {
      Taro.showToast({ title: '标签已存在', icon: 'none' });
      return;
    }

    setTags((prev) => [...prev, nextTag]);
    setNewTag('');
  }

  function handleRemoveTag(tag: string) {
    setTags((prev) => prev.filter((item) => item !== tag));
  }

  function handleToggleTimeWindow(value: string) {
    setTimeWindows((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }

  function handleToggleMood(value: MoodType) {
    setMoods((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }

  async function handleSave() {
    if (!mediaId) {
      return;
    }

    if (!title.trim()) {
      Taro.showToast({ title: '请先填写标题', icon: 'none' });
      return;
    }

    try {
      setSaving(true);
      await updateMedia(mediaId, {
        title: title.trim(),
        description: description.trim(),
        tags,
        time_windows: timeWindows,
        moods,
        occasions: occasion ? [occasion] : [],
        cooldown,
        priority,
      });
      Taro.showToast({ title: '策略已保存', icon: 'success' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!mediaId) {
      return;
    }

    const result = await Taro.showModal({
      title: '删除媒体',
      content: '确认删除这条内容吗？删除后老人端将不再推荐它。',
    });

    if (!result.confirm) {
      return;
    }

    try {
      await deleteMedia(mediaId);
      Taro.showToast({ title: '已删除', icon: 'success' });
      Taro.redirectTo({ url: '/pages/family/media/index' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  return (
    <View className='ke-page'>
      {detail ? (
        <>
          <View className='ke-hero'>
            <Text className='ke-eyebrow'>Media Policy</Text>
            <Text className='ke-title'>给回忆内容加上标签和触发策略</Text>
            <Text className='ke-subtitle'>
              这一页把 Web 版里的“打标 + 推荐条件”压缩成更适合小程序的编辑流程，方便家属随手维护。
            </Text>
            <View className='ke-chip-row' style={{ marginTop: '22rpx' }}>
              <Text className='ke-chip ke-chip--warm'>{detail.media_type === 'video' ? '视频' : '照片'}</Text>
              <Text className='ke-chip'>播放 {detail.statistics?.total_plays ?? 0}</Text>
              <Text className='ke-chip'>喜欢 {detail.statistics?.likes ?? 0}</Text>
              <Text className='ke-chip'>不喜欢 {detail.statistics?.dislikes ?? 0}</Text>
            </View>
          </View>

          <SectionCard title='内容预览' caption='先确认你正在编辑的是哪一条内容'>
            <View className='ke-card ke-media'>
              <View className='ke-media__thumb'>
                <Image
                  className='ke-media__thumb-img'
                  mode='aspectFill'
                  src={detail.thumbnail_path ? getThumbnailUrl(detail.thumbnail_path) : getMediaUrl(detail.file_path)}
                />
              </View>
              <View>
                <Text className='ke-card__title'>{detail.title}</Text>
                <View className='ke-card__meta'>
                  <Text>{detail.media_type === 'video' ? '视频' : '照片'}</Text>
                  <Text>上传于 {formatDateTimeText(detail.created_at)}</Text>
                  {detail.last_played_at ? <Text>最近播放 {formatDateTimeText(detail.last_played_at)}</Text> : null}
                </View>
                {detail.description ? <Text className='ke-card__body'>{detail.description}</Text> : null}
              </View>
            </View>
          </SectionCard>

          <SectionCard title='基本信息' caption='修改标题与补充说明'>
            <View className='ke-form'>
              <View>
                <Text className='ke-label'>标题</Text>
                <Input className='ke-input' value={title} onInput={(e) => setTitle(e.detail.value)} />
              </View>
              <View>
                <Text className='ke-label'>说明</Text>
                <Textarea
                  className='ke-textarea'
                  value={description}
                  maxlength={200}
                  placeholder='例如：小米毕业那天一起拍的合影'
                  onInput={(e) => setDescription(e.detail.value)}
                />
              </View>
            </View>
          </SectionCard>

          <SectionCard title='人物 / 场景标签' caption='支持添加多个关键词，帮助后续精细筛选'>
            <View className='ke-form'>
              <View className='ke-chip-row'>
                {tags.length ? (
                  tags.map((tag) => (
                    <Text className='ke-chip ke-chip--warm' key={tag} onClick={() => handleRemoveTag(tag)}>
                      {tag} ×
                    </Text>
                  ))
                ) : (
                  <Text className='ke-section-caption'>还没有标签，点下面输入框先加一个。</Text>
                )}
              </View>
              <View className='ke-form__row'>
                <Input
                  className='ke-input'
                  value={newTag}
                  placeholder='例如：孙女小米'
                  onInput={(e) => setNewTag(e.detail.value)}
                  onConfirm={handleAddTag}
                />
                <Button className='ke-button--ghost' onClick={handleAddTag}>
                  添加标签
                </Button>
              </View>
            </View>
          </SectionCard>

          <SectionCard title='播放时段' caption='只有命中时段时，老人端才更容易被推荐到'>
            <View className='ke-pill-grid'>
              {mediaTimeWindowOptions.map((option) => (
                <View
                  key={option.value}
                  className={`ke-pill ${timeWindows.includes(option.value) ? 'ke-pill--active' : ''}`}
                  onClick={() => handleToggleTimeWindow(option.value)}
                >
                  <Text>{option.label}</Text>
                  <Text className='ke-section-caption'>{option.value}</Text>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title='适合心情' caption='用来控制这条内容更适合什么状态下出现'>
            <View className='ke-pill-grid'>
              {(Object.keys(moodLabelMap) as MoodType[]).map((option) => (
                <View
                  key={option}
                  className={`ke-pill ${moods.includes(option) ? 'ke-pill--active' : ''}`}
                  onClick={() => handleToggleMood(option)}
                >
                  <Text>{moodLabelMap[option]}</Text>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title='特殊场合与推荐强度' caption='这两项决定它多久出现一次、优先级多高'>
            <View className='ke-form'>
              <View>
                <Text className='ke-label'>特殊场合</Text>
                <Picker
                  mode='selector'
                  range={mediaOccasionOptions.map((item) => item.label)}
                  value={Math.max(
                    mediaOccasionOptions.findIndex((item) => item.value === occasion),
                    0
                  )}
                  onChange={(e) => setOccasion(mediaOccasionOptions[Number(e.detail.value)].value)}
                >
                  <View className='ke-picker'>
                    {mediaOccasionOptions.find((item) => item.value === occasion)?.label || '无特殊场合'}
                  </View>
                </Picker>
              </View>

              <View className='ke-form__row'>
                <View>
                  <Text className='ke-label'>冷却时间</Text>
                  <Picker
                    mode='selector'
                    range={mediaCooldownOptions.map((item) => item.label)}
                    value={Math.max(
                      mediaCooldownOptions.findIndex((item) => item.value === cooldown),
                      0
                    )}
                    onChange={(e) => setCooldown(mediaCooldownOptions[Number(e.detail.value)].value)}
                  >
                    <View className='ke-picker'>
                      {mediaCooldownOptions.find((item) => item.value === cooldown)?.label || '1 小时'}
                    </View>
                  </Picker>
                </View>

                <View>
                  <Text className='ke-label'>推荐优先级</Text>
                  <Picker
                    mode='selector'
                    range={mediaPriorityOptions.map((item) => item.label)}
                    value={Math.max(
                      mediaPriorityOptions.findIndex((item) => item.value === priority),
                      0
                    )}
                    onChange={(e) => setPriority(mediaPriorityOptions[Number(e.detail.value)].value)}
                  >
                    <View className='ke-picker'>
                      {mediaPriorityOptions.find((item) => item.value === priority)?.label || '5 级'}
                    </View>
                  </Picker>
                </View>
              </View>
            </View>
          </SectionCard>

          <SectionCard title='保存与删除' caption='先保存策略，再决定是否移除这条内容'>
            <View className='ke-actions'>
              <Button className='ke-button' loading={saving} onClick={handleSave}>
                保存策略
              </Button>
              <Button className='ke-button--danger' onClick={handleDelete}>
                删除媒体
              </Button>
            </View>
          </SectionCard>

          <SectionCard title='最近播放反馈' caption='看看这条内容最近有没有被看、有没有得到正向反馈'>
            {detail.history?.length ? (
              <View className='ke-card-list'>
                {detail.history.map((item) => (
                  <View className='ke-card' key={item.id}>
                    <View className='ke-section-head' style={{ marginBottom: '10rpx' }}>
                      <Text className='ke-card__title'>{item.elderly_name || `老人 ${item.elderly_id}`}</Text>
                      <Text className='ke-section-caption'>{formatDateTimeText(item.played_at)}</Text>
                    </View>
                    <View className='ke-card__meta'>
                      <Text>{item.triggered_by || 'manual'}</Text>
                      <Text>{item.completed ? '完整看完' : '中途结束'}</Text>
                      <Text>时长 {formatDurationSeconds(item.duration_watched)}</Text>
                    </View>
                    <View className='ke-chip-row' style={{ marginTop: '14rpx' }}>
                      <Text className='ke-chip ke-chip--warm'>{getHistoryFeedbackChip(item)}</Text>
                      {item.mood_before ? <Text className='ke-chip'>播放前 {item.mood_before}</Text> : null}
                      {item.mood_after ? <Text className='ke-chip'>播放后 {item.mood_after}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title='还没有最近播放反馈' hint='等老人端开始播放这条内容后，这里会看到最近 10 条反馈记录。' />
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard title='媒体详情' caption='当前链接里没有可用的 mediaId，或内容已被移除'>
          <EmptyState title='暂时找不到这条媒体' hint='请回到媒体库列表重新选择一条内容。' />
        </SectionCard>
      )}

      {loading ? <Text className='ke-footnote'>正在加载媒体详情...</Text> : null}
    </View>
  );
}
