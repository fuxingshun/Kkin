import Taro from '@tarojs/taro';
import { Button, ScrollView, Text, View } from '@tarojs/components';
import '../legal.css';

const sections = [
  {
    title: '服务定位',
    items: [
      'KinEcho 面向受邀家庭提供陪伴、提醒、家庭沟通和照护协同支持。',
      '心理关怀、情绪记录、AI 陪伴和采集结果仅用于健康关怀与风险筛查参考。',
      'KinEcho 不提供医学诊断、治疗建议、急救替代方案或保证性风险判断。',
    ],
  },
  {
    title: '账号与使用',
    items: [
      '用户应使用本人微信或经家庭授权的账号登录，不得冒用他人身份。',
      '老人、家属和服务人员只能访问被授权的家庭数据和服务记录。',
      '服务人员账号需完成认证审核后使用服务协同功能。',
    ],
  },
  {
    title: '高风险事件',
    items: [
      '出现自伤、轻生、跌倒、失联或其他紧急风险时，应立即联系家属、服务人员或当地急救渠道。',
      '系统识别到高风险信号时，可能生成家庭提醒和服务工单，供家属和服务人员跟进。',
      'AI 回复不能替代家属照护、专业咨询、医生判断或急救服务。',
    ],
  },
  {
    title: '内容与责任',
    items: [
      '家庭上传的照片、视频、留言和提醒应取得相关成员授权，不得上传违法或侵权内容。',
      '咨询预约、服务记录和家庭可见摘要按授权范围展示。',
      '若用户违反本协议或影响试点安全，平台可限制相关功能并保留审计记录。',
    ],
  },
];

export default function UserAgreementPage() {
  return (
    <View className='legal-page'>
      <ScrollView className='legal-scroll' scrollY>
        <View className='legal-hero'>
          <Text className='legal-kicker'>KinEcho</Text>
          <Text className='legal-title'>用户协议</Text>
          <Text className='legal-subtitle'>适用于封闭试点阶段的老人端、家属端、服务人员端和管理后台。</Text>
        </View>

        <View className='legal-card'>
          <Text className='legal-effective'>版本：pilot-v1 · 生效日期：2026-05-05</Text>
          {sections.map((section) => (
            <View className='legal-section' key={section.title}>
              <Text className='legal-section__title'>{section.title}</Text>
              {section.items.map((item) => (
                <View className='legal-row' key={item}>
                  <Text className='legal-dot'>•</Text>
                  <Text className='legal-text'>{item}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View className='legal-actions'>
        <Button className='legal-button' onClick={() => Taro.navigateBack()}>
          我已了解
        </Button>
      </View>
    </View>
  );
}
