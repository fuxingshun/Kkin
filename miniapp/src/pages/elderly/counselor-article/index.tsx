import Taro, { useRouter } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { AppIcon } from '@/components/AppIcon';

type ArticlePreset = {
  signal: string;
  advice: string[];
  support: string[];
};

function readParam(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return '';

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function getArticlePreset(topic: string): ArticlePreset {
  if (/焦虑|担心|紧张|害怕/.test(topic)) {
    return {
      signal: '焦虑常常不是“想太多”，而是身体在提醒我们：最近需要更多确定感和陪伴。老人遇到身体变化、子女不在身边、生活节奏被打乱时，都可能更容易担心。',
      advice: ['把担心写成一句具体的话，例如“我怕晚上睡不好”，再看这件事今天能做哪一步。', '每天固定一个安心动作，比如晚饭后散步十分钟、听一段熟悉的音乐。', '遇到反复担心时，先慢慢呼气，再联系家人或咨询师，不急着一个人扛。'],
      support: ['连续几天坐立不安、睡不踏实。', '总觉得会出事，影响吃饭、出门或和人说话。', '已经努力调整，但心里还是很紧，可以请专业咨询师一起梳理。'],
    };
  }

  if (/抑郁|低落|无价值|自我价值|孤独/.test(topic)) {
    return {
      signal: '心情低落不代表人变脆弱。很多老人退休后角色变化、朋友减少、身体不如从前，都会有“我是不是没用了”的感觉，这些感受值得被认真听见。',
      advice: ['每天安排一件能完成的小事，完成后给自己记一笔，不要求做得完美。', '主动保留一点和人的连接，可以是一通电话、一次散步、一次社区活动。', '把“我不行了”换成“我今天有点累，需要慢一点”。'],
      support: ['两周以上经常没兴趣、没力气。', '明显不想见人，或者觉得自己拖累别人。', '出现伤害自己的念头时，要立刻告诉家人并寻求医生或咨询师帮助。'],
    };
  }

  if (/家庭|人际|关系|伴侣|沟通/.test(topic)) {
    return {
      signal: '关系里的委屈往往不是小事。老人有时怕麻烦子女、怕说了被嫌弃，于是把需要都放在心里，时间久了就容易难过或生气。',
      advice: ['先说感受，再说请求，例如“我有点担心，能不能晚上给我回个电话”。', '把一次谈话只放一个主题，不把过去所有委屈都放在同一次里讲。', '如果说不出口，可以请咨询师帮忙把话整理得更清楚。'],
      support: ['和家人一说话就争吵，或者长期冷着不说。', '觉得自己没人理解，常常憋在心里。', '重要关系影响到睡眠、食欲和日常生活时，适合寻求专业支持。'],
    };
  }

  if (/睡眠|失眠|躯体|身体/.test(topic)) {
    return {
      signal: '睡不好、胸口闷、胃口差，有时和情绪压力有关。身体不舒服当然要先看医生，同时也可以留意最近是不是有担心、委屈或孤单。',
      advice: ['睡前少刷刺激内容，固定一个放松流程，比如洗漱、热水泡脚、关灯。', '白天尽量接触自然光，午睡不要太久。', '把夜里反复想的事写下来，告诉自己明天白天再处理。'],
      support: ['睡眠问题持续影响白天精神。', '身体检查没有明显异常，但不适反复出现。', '越担心身体越难受时，可以让医生和心理咨询师一起协助。'],
    };
  }

  return {
    signal: `${topic}背后常常藏着一个简单的需要：希望被理解、被尊重，也希望生活还有掌控感。对老人来说，这些感受不需要硬压下去，可以慢慢说出来。`,
    advice: ['先给感受起个名字：是担心、委屈、孤单，还是害怕。', '选择一个信任的人聊十分钟，不急着讲完整，只讲最难受的一点。', '把今天能做的小行动写下来，越具体越好。'],
    support: ['情绪反复出现，已经影响吃饭、睡觉或出门。', '很多话不想和家人说，但一个人又很难受。', '希望有人耐心听、一起想办法时，可以预约咨询师。'],
  };
}

export default function ElderlyCounselorArticlePage() {
  const router = useRouter();
  const topic = readParam(router.params?.topic) || '情绪照护';
  const counselorName = readParam(router.params?.name) || '咨询师';
  const counselorTitle = readParam(router.params?.title) || '心理咨询师';
  const specialty = readParam(router.params?.specialty) || topic;
  const counselorId = readParam(router.params?.id);
  const article = getArticlePreset(topic);

  function bookCounselor() {
    if (counselorId) {
      void Taro.navigateTo({
        url: `/pages/elderly/counselor-detail/index?id=${counselorId}`,
      });
      return;
    }

    void Taro.navigateBack();
  }

  return (
    <View className='pc-page ca-page'>
      <View className='pc-question-detail-head ca-head'>
        <Text className='pc-top-back' onClick={() => Taro.navigateBack()}>
          ‹
        </Text>
        <Text className='pc-question-detail-title'>长辈心理科普</Text>
        <Text className='pc-top-space' />
      </View>

      <View className='ca-hero'>
        <View className='ca-kicker'>
          <AppIcon name='book' />
          <Text>咨询师专栏</Text>
        </View>
        <Text className='ca-title'>给长辈看的{topic}小科普</Text>
        <Text className='ca-summary'>不用讲大道理，先把心里的不舒服看清楚，再找到今天能做的一小步。</Text>
        <View className='ca-author'>
          <Text>{counselorName}</Text>
          <Text>{counselorTitle}</Text>
          <Text>{specialty}</Text>
        </View>
      </View>

      <View className='ca-card'>
        <View className='ca-section-head'>
          <AppIcon name='heart' />
          <Text>先别责怪自己</Text>
        </View>
        <Text className='ca-paragraph'>{article.signal}</Text>
      </View>

      <View className='ca-card'>
        <View className='ca-section-head'>
          <AppIcon name='check' />
          <Text>今天可以试试</Text>
        </View>
        <View className='ca-list'>
          {article.advice.map((item, index) => (
            <View className='ca-list-row' key={item}>
              <Text className='ca-list-index'>{index + 1}</Text>
              <Text className='ca-list-text'>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='ca-card ca-card--warm'>
        <View className='ca-section-head'>
          <AppIcon name='shield' />
          <Text>什么时候要找人聊聊</Text>
        </View>
        <View className='ca-list'>
          {article.support.map((item) => (
            <View className='ca-support-row' key={item}>
              <View className='ca-support-dot' />
              <Text className='ca-list-text'>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='ca-note'>
        <Text>提示：科普不能代替诊断。如果身体明显不舒服，先及时就医；如果心里一直难受，也可以让家人陪同预约咨询。</Text>
      </View>

      <View className='ca-actions'>
        <Button className='pc-detail-button ca-primary-button' onClick={bookCounselor}>
          找这位咨询师聊聊
        </Button>
      </View>
    </View>
  );
}
