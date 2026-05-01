import { useCallback, useMemo, useState } from 'react';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import {
  getPsychologyQuestionDetail,
  type PsychologyQuestion,
  type PsychologyQuestionReply,
} from '@/services/mentalHealth';

function parseQuestionId(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function replyTypeLabel(type: string) {
  if (type === 'answer') return '回答';
  if (type === 'comment') return '评论';
  return '分享';
}

export default function ElderlyPsychologyQuestionPage() {
  const router = useRouter();
  const questionId = parseQuestionId(router.params?.id);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<PsychologyQuestion | null>(null);
  const [replies, setReplies] = useState<PsychologyQuestionReply[]>([]);

  const loadData = useCallback(async () => {
    if (!questionId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const detail = await getPsychologyQuestionDetail(questionId);
      setQuestion(detail.question);
      setReplies(detail.replies);
    } catch (error) {
      const message = error instanceof Error ? error.message : '问题详情加载失败';
      Taro.showToast({ title: message, icon: 'none' });
      setQuestion(null);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useDidShow(() => {
    void loadData();
  });

  const answerCount = useMemo(() => replies.filter((item) => item.reply_type === 'answer').length, [replies]);
  const commentCount = Math.max(replies.length - answerCount, 0);

  return (
    <View className='pc-page pc-question-detail-page'>
      <View className='pc-question-detail-head'>
        <Text className='pc-top-back' onClick={() => Taro.navigateBack()}>
          ‹
        </Text>
        <Text className='pc-question-detail-title'>大家的回答</Text>
        <Text className='pc-top-space' />
      </View>

      <View className='pc-question-hero'>
        <Text className='pc-question-hero__label'>心理百科问答</Text>
        <Text className='pc-question-hero__title'>{question?.question || (loading ? '正在加载问题...' : '问题不存在')}</Text>
        <View className='pc-question-hero__meta'>
          <Text>{answerCount} 条回答</Text>
          <Text>{commentCount} 条评论</Text>
        </View>
      </View>

      <View className='pc-reply-list'>
        {replies.length ? (
          replies.map((reply) => (
            <View className={`pc-reply-card pc-reply-card--${reply.reply_type}`} key={reply.id}>
              <View className='pc-reply-card__head'>
                <View className='pc-reply-avatar'>
                  <Text>{reply.author_name.slice(0, 1) || '友'}</Text>
                </View>
                <View className='pc-reply-author'>
                  <Text className='pc-reply-author__name'>{reply.author_name}</Text>
                  <Text className='pc-reply-author__role'>{reply.author_role || replyTypeLabel(reply.reply_type)}</Text>
                </View>
                <Text className='pc-reply-type'>{replyTypeLabel(reply.reply_type)}</Text>
              </View>
              <Text className='pc-reply-content'>{reply.content}</Text>
              <View className='pc-reply-footer'>
                <Text>{reply.like_count || 0} 人觉得有帮助</Text>
              </View>
            </View>
          ))
        ) : (
          <View className='pc-empty-card'>
            <Text className='pc-empty-title'>{loading ? '正在加载...' : '暂时还没有回答'}</Text>
            <Text className='pc-empty-text'>后续从数据库补充回答后，会展示在这里。</Text>
          </View>
        )}
      </View>

      <View className='pc-question-detail-actions'>
        <Button className='pc-detail-button' onClick={() => Taro.navigateBack()}>
          返回问题列表
        </Button>
      </View>
    </View>
  );
}
