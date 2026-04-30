import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Input, Text, View } from '@tarojs/components';
import { ElderlyTabBar } from '@/components/ElderlyTabBar';

const categories = [
  { id: 1, name: '情绪疏导', icon: '😊', className: 'pc-category--blue' },
  { id: 2, name: '睡眠问题', icon: '😴', className: 'pc-category--purple' },
  { id: 3, name: '慢性病心理', icon: '💊', className: 'pc-category--green' },
  { id: 4, name: '家庭关系', icon: '👨‍👩‍👧', className: 'pc-category--pink' },
  { id: 5, name: '退休适应', icon: '🌱', className: 'pc-category--amber' },
  { id: 6, name: '记忆认知', icon: '🧠', className: 'pc-category--teal' },
  { id: 7, name: '失落哀伤', icon: '🕊️', className: 'pc-category--gray' },
  { id: 8, name: '健康焦虑', icon: '❤️', className: 'pc-category--red' },
];

const articles = [
  {
    id: 1,
    title: '老年人如何保持良好的睡眠质量',
    author: '张医生',
    coverClassName: 'pc-article-cover--blue',
    views: 1289,
    likes: 156,
    category: '睡眠健康',
  },
  {
    id: 2,
    title: '退休后的心理调适：找到新的生活意义',
    author: '李心理师',
    coverClassName: 'pc-article-cover--green',
    views: 2341,
    likes: 289,
    category: '退休适应',
  },
  {
    id: 3,
    title: '慢性病患者的情绪管理技巧',
    author: '王主任',
    coverClassName: 'pc-article-cover--pink',
    views: 986,
    likes: 98,
    category: '慢性病心理',
  },
  {
    id: 4,
    title: '如何与子女建立更好的沟通方式',
    author: '赵咨询师',
    coverClassName: 'pc-article-cover--amber',
    views: 1567,
    likes: 234,
    category: '家庭关系',
  },
];

const commonQuestions = [
  '总是睡不好觉，该怎么办？',
  '退休后感到生活没有意义',
  '如何与子女更好地沟通？',
  '经常忘记事情，很担心',
  '慢性病让我很焦虑',
];

export default function ElderlyPsychologicalConsultingPage() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  return (
    <View className='pc-page ef-page--tab'>
      <View className='pc-search-head'>
        <Text className='pc-title'>心理咨询</Text>
        <View className='pc-search-box'>
          <Text className='pc-search-icon'>⌕</Text>
          <Input className='pc-search-input' placeholder='搜索咨询师或心理问题' placeholderClass='pc-search-placeholder' />
        </View>
      </View>

      <View className='pc-section pc-section--match'>
        <View className='pc-match-card' onClick={() => Taro.navigateTo({ url: '/pages/elderly/counselor-list/index' })}>
          <View className='pc-match-icon'>
            <Text>✦</Text>
          </View>
          <View className='pc-match-body'>
            <Text className='pc-match-title'>智能匹配咨询师</Text>
            <Text className='pc-match-desc'>根据您的情况，为您推荐最合适的咨询师</Text>
          </View>
          <Text className='pc-chevron'>〉</Text>
        </View>
      </View>

      <View className='pc-section pc-section--compact'>
        <View className='pc-counselor-link' onClick={() => Taro.navigateTo({ url: '/pages/elderly/counselor-list/index' })}>
          <View className='pc-soft-icon'>
            <Text>人</Text>
          </View>
          <View className='pc-link-body'>
            <Text className='pc-link-title'>查看全部咨询师</Text>
            <Text className='pc-link-desc'>浏览所有专业心理咨询师</Text>
          </View>
          <Text className='pc-chevron pc-chevron--gray'>〉</Text>
        </View>
      </View>

      <View className='pc-section'>
        <Text className='pc-section-title'>常见心理问题</Text>
        <View className='pc-category-grid'>
          {categories.map((category) => (
            <View
              key={category.id}
              className={`pc-category ${selectedCategory === category.id ? `pc-category--selected ${category.className}` : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <Text className='pc-category-icon'>{category.icon}</Text>
              <Text className='pc-category-name'>{category.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='pc-section'>
        <View className='pc-section-head'>
          <View className='pc-title-row'>
            <Text className='pc-title-icon'>书</Text>
            <Text className='pc-section-title'>心理百科</Text>
          </View>
          <Text className='pc-more'>查看更多</Text>
        </View>
        <View className='pc-article-grid'>
          {articles.map((article) => (
            <View className='pc-article-card' key={article.id}>
              <View className={`pc-article-cover ${article.coverClassName}`}>
                <View className='pc-article-cover-icon'>
                  <Text>书</Text>
                </View>
              </View>
              <View className='pc-article-body'>
                <Text className='pc-article-category'>{article.category}</Text>
                <Text className='pc-article-title'>{article.title}</Text>
                <View className='pc-article-meta'>
                  <Text>{article.author}</Text>
                  <View className='pc-article-meta__stats'>
                    <Text>眼 {article.views}</Text>
                    <Text>心 {article.likes}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className='pc-section'>
        <Text className='pc-section-title'>大家都在问</Text>
        <View className='pc-question-list'>
          {commonQuestions.map((question) => (
            <View className='pc-question-row' key={question}>
              <View className='pc-question-main'>
                <Text className='pc-question-icon'>聊</Text>
                <Text className='pc-question-text'>{question}</Text>
              </View>
              <Text className='pc-chevron pc-chevron--gray'>〉</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='pc-section pc-section--tip'>
        <View className='pc-tip-card'>
          <Text className='pc-tip-title'>温馨提示</Text>
          <View className='pc-tip-list'>
            <View className='pc-tip-row'><Text /> <Text>咨询师严格遵守保密原则，您的隐私将得到充分保护</Text></View>
            <View className='pc-tip-row'><Text /> <Text>建议在安静舒适的环境中进行咨询，确保通话质量</Text></View>
            <View className='pc-tip-row'><Text /> <Text>如遇紧急情况，请及时拨打紧急联系人电话</Text></View>
          </View>
        </View>
      </View>

      <ElderlyTabBar active='consulting' />
    </View>
  );
}
