import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Image, Input, Text, View } from '@tarojs/components';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';
import { getCounselors, type Counselor } from '@/services/elderly';
import {
  getPsychologyResources,
  type PsychologyCategory,
  type PsychologyQuestion,
  type PsychologyVideo,
} from '@/services/mentalHealth';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';

function includesKeyword(value: string, keyword: string) {
  return !keyword || value.includes(keyword);
}

export default function ElderlyPsychologicalConsultingPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [videos, setVideos] = useState<PsychologyVideo[]>([]);
  const [categories, setCategories] = useState<PsychologyCategory[]>([]);
  const [questions, setQuestions] = useState<PsychologyQuestion[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [nextCounselors, resources] = await Promise.all([
        getCounselors(),
        getPsychologyResources(),
      ]);
      setCounselors(nextCounselors);
      setVideos(resources.videos);
      setCategories(resources.categories);
      setQuestions(resources.questions);
    } catch {
      setCounselors([]);
      setVideos([]);
      setCategories([]);
      setQuestions([]);
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  const filteredArticles = useMemo(
    () => videos.filter((item) => includesKeyword(`${item.title}${item.category || ''}${item.speaker || ''}`, keyword.trim())),
    [keyword, videos]
  );

  const filteredQuestions = useMemo(
    () => questions.filter((item) => includesKeyword(item.question, keyword.trim())),
    [keyword, questions]
  );

  const availableCount = counselors.filter((item) => item.available).length;

  function openCounselors(filter = 'online', topic = keyword.trim()) {
    const params = [`filter=${encodeURIComponent(filter)}`];
    if (topic) {
      params.push(`topic=${encodeURIComponent(topic)}`);
    }
    Taro.navigateTo({ url: `/pages/elderly/counselor-list/index?${params.join('&')}` });
  }

  function openPsychologyVideo(videoId: string) {
    Taro.navigateTo({ url: `/pages/elderly/psychology-video/index?id=${encodeURIComponent(videoId)}` });
  }

  function openQuestionDetail(questionId: number) {
    Taro.navigateTo({ url: `/pages/elderly/psychology-question/index?id=${questionId}` });
  }

  function chooseCategory(category: PsychologyCategory) {
    setSelectedCategory(category.id);
    openCounselors('online', category.name);
  }

  return (
    <View className={`pc-page ef-page--tab ${preferenceClassName}`}>
      <View className='pc-search-head'>
        <Text className='pc-title'>心理咨询</Text>
        <View className='pc-search-box'>
          <Text className='pc-search-icon'>搜</Text>
          <Input
            className='pc-search-input'
            value={keyword}
            placeholder='搜索咨询师或心理问题'
            placeholderClass='pc-search-placeholder'
            onConfirm={() => openCounselors('all')}
            onInput={(event) => setKeyword(event.detail.value)}
          />
        </View>
      </View>

      <View className='pc-section pc-section--match'>
        <View className='pc-match-card' onClick={() => openCounselors('online')}>
          <View className='pc-match-icon'>
            <Text>咨</Text>
          </View>
          <View className='pc-match-body'>
            <Text className='pc-match-title'>智能匹配咨询师</Text>
            <Text className='pc-match-desc'>当前 {availableCount} 位咨询师可预约，数据来自数据库。</Text>
          </View>
          <Text className='pc-chevron'>›</Text>
        </View>
      </View>

      <View className='pc-section pc-section--compact'>
        <View className='pc-counselor-link' onClick={() => openCounselors('all')}>
          <View className='pc-soft-icon'>
            <Text>人</Text>
          </View>
          <View className='pc-link-body'>
            <Text className='pc-link-title'>查看全部咨询师</Text>
            <Text className='pc-link-desc'>从后端咨询师库读取并按可预约状态排序</Text>
          </View>
          <Text className='pc-chevron pc-chevron--gray'>›</Text>
        </View>
      </View>

      {categories.length ? (
        <View className='pc-section'>
          <Text className='pc-section-title'>常见心理问题</Text>
          <View className='pc-category-grid'>
            {categories.map((category) => (
              <View
                key={category.id}
                className={`pc-category ${category.class_name || ''} ${selectedCategory === category.id ? 'pc-category--selected' : ''}`}
                onClick={() => chooseCategory(category)}
              >
                <Text className='pc-category-icon'>{category.icon || '·'}</Text>
                <Text className='pc-category-name'>{category.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View className='pc-section'>
        <View className='pc-section-head'>
          <View className='pc-title-row'>
            <Text className='pc-title-icon'>学</Text>
            <Text className='pc-section-title'>心理百科</Text>
          </View>
          <Text className='pc-more' onClick={() => openCounselors('experienced')}>找专家</Text>
        </View>
        <View className='pc-article-grid'>
          {filteredArticles.map((article) => (
            <View className='pc-article-card' key={article.slug} onClick={() => openPsychologyVideo(article.slug)}>
              <View className={`pc-article-cover ${article.cover_class_name || ''}`}>
                {article.poster_url ? <Image className='pc-article-cover-image' src={article.poster_url} mode='widthFix' /> : null}
                <View className='pc-article-cover-shade' />
                <View className='pc-article-play-badge'>
                  <Text>▶</Text>
                </View>
              </View>
              <View className='pc-article-body'>
                <Text className='pc-article-category'>{article.category || '心理健康'}</Text>
                <Text className='pc-article-title'>{article.title}</Text>
                <View className='pc-article-meta'>
                  <Text>{article.duration || '视频讲解'}</Text>
                  <View className='pc-article-meta__stats'>
                    <Text>{article.speaker || '数据库内容'}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {filteredQuestions.length ? (
        <View className='pc-section'>
          <Text className='pc-section-title'>大家都在问</Text>
          <View className='pc-question-list'>
            {filteredQuestions.map((item) => (
              <View className='pc-question-row' key={item.id} onClick={() => openQuestionDetail(item.id)}>
                <View className='pc-question-main'>
                  <Text className='pc-question-icon'>问</Text>
                  <View className='pc-question-body'>
                    <Text className='pc-question-text'>{item.question}</Text>
                    {item.reply_count ? <Text className='pc-question-meta'>{item.reply_count} 条回答与评论</Text> : null}
                  </View>
                </View>
                <Text className='pc-chevron pc-chevron--gray'>›</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View className='pc-section pc-section--tip'>
        <View className='pc-tip-card'>
          <Text className='pc-tip-title'>温馨提示</Text>
          <View className='pc-tip-list'>
            <View className='pc-tip-row'><Text /> <Text>咨询记录会同步到家属端和服务端，方便后续跟进。</Text></View>
            <View className='pc-tip-row'><Text /> <Text>建议在安静环境中进行咨询，保证通话质量。</Text></View>
            <View className='pc-tip-row'><Text /> <Text>如遇紧急情况，请优先联系家属或使用紧急求助。</Text></View>
          </View>
        </View>
      </View>

      <ElderlyTabBar active='consulting' />
    </View>
  );
}
