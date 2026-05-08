import Taro from '@tarojs/taro';
import { Button, ScrollView, Text, View } from '@tarojs/components';
import '../legal.css';

const sections = [
  {
    title: '我们收集的信息',
    items: [
      '账号身份：微信登录标识、角色、姓名或昵称、家庭绑定关系和服务认证状态。',
      '照护数据：心情记录、提醒完成情况、求助提醒、咨询预约、服务处理记录和家属可见摘要。',
      '媒体数据：家庭主动上传的照片、视频、留言文本，以及老人端播放和反馈记录。',
    ],
  },
  {
    title: '信息使用范围',
    items: [
      '用于完成登录鉴权、家庭数据隔离、老人陪伴、家属通知、服务工单和封闭试点运营。',
      '用于识别自伤、轻生等高风险关键词，并生成家庭提醒或服务工单。',
      '不会把心理关怀结果作为医学诊断结论，不会用于无关广告投放。',
    ],
  },
  {
    title: '共享与访问控制',
    items: [
      '老人、家属、服务人员和管理员按角色访问授权范围内的数据。',
      '上传媒体通过受控接口访问，不再通过公开上传目录直接暴露。',
      '咨询记录仅展示家庭可见摘要，完整服务记录按授权和审计规则管理。',
    ],
  },
  {
    title: '导出、删除与保留',
    items: [
      '家属可提交数据导出、删除或更正请求，平台会记录处理状态和审计日志。',
      '音频、图片、聊天和咨询记录按试点保留策略管理，到期后进行清理或归档。',
      '为处理安全事件、合规审计和服务纠纷，必要记录可能在合理期限内保留。',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <View className='legal-page'>
      <ScrollView className='legal-scroll' scrollY>
        <View className='legal-hero legal-hero--green'>
          <Text className='legal-kicker'>KinEcho</Text>
          <Text className='legal-title'>隐私政策</Text>
          <Text className='legal-subtitle'>说明封闭试点阶段个人信息、家庭数据和上传媒体的处理方式。</Text>
        </View>

        <View className='legal-card'>
          <Text className='legal-effective'>版本：pilot-v1 · 生效日期：2026-05-05</Text>
          {sections.map((section) => (
            <View className='legal-section' key={section.title}>
              <Text className='legal-section__title'>{section.title}</Text>
              {section.items.map((item) => (
                <View className='legal-row' key={item}>
                  <Text className='legal-dot legal-dot--green'>•</Text>
                  <Text className='legal-text'>{item}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View className='legal-actions'>
        <Button className='legal-button legal-button--green' onClick={() => Taro.navigateBack()}>
          我已了解
        </Button>
      </View>
    </View>
  );
}
