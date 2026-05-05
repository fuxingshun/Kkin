import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { submitServiceCertification } from '@/services/auth';
import { getServiceSession, saveServiceSession } from '@/utils/serviceSession';

export default function ServiceCertificationPage() {
  const session = getServiceSession();
  const [name, setName] = useState(session.displayName || '');
  const [staffNo, setStaffNo] = useState('');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const openid = session.wechatOpenid || '';
    const nextName = name.trim();
    const nextStaffNo = staffNo.trim();
    const nextOrganization = organization.trim();
    const nextPhone = phone.trim();

    if (!openid) {
      Taro.showModal({
        title: '需要重新授权',
        content: '请返回身份选择页，重新通过微信授权后再提交认证。',
        showCancel: false,
      });
      return;
    }

    if (!nextName || !nextStaffNo || !nextOrganization || !nextPhone) {
      Taro.showToast({ title: '请完整填写认证资料', icon: 'none' });
      return;
    }

    try {
      setSaving(true);
      const result = await submitServiceCertification({
        openid,
        name: nextName,
        staff_no: nextStaffNo,
        organization: nextOrganization,
        phone: nextPhone,
      });
      saveServiceSession({
        displayName: nextName,
        wechatOpenid: openid,
        certificationStatus: result.status,
      });
      Taro.showToast({ title: '已提交审核', icon: 'success' });
      setTimeout(() => {
        void Taro.redirectTo({ url: '/pages/service/review-pending/index' });
      }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : '认证提交失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className='auth-flow-page auth-flow-page--service'>
      <View className='auth-topbar'>
        <Text className='auth-back' onClick={() => Taro.redirectTo({ url: '/pages/role/index' })}>‹</Text>
        <Text className='auth-topbar__title'>服务人员认证</Text>
        <Text className='auth-topbar__space' />
      </View>

      <View className='auth-intro'>
        <View className='auth-mark'>
          <Text>服</Text>
        </View>
        <View className='auth-intro__body'>
          <Text className='auth-kicker'>仅限认证服务人员使用</Text>
          <Text className='auth-title'>提交服务身份</Text>
          <Text className='auth-desc'>用于核验服务资质，审核通过后开放专业工作台。</Text>
        </View>
      </View>

      <View className='auth-card'>
        <View className='auth-card-head'>
          <Text className='auth-section-title'>认证信息</Text>
          <Text className='auth-section-note'>请填写真实资料</Text>
        </View>
        <View className='ke-form'>
          <View>
            <Text className='ke-label'>姓名</Text>
            <Input className='ke-input' value={name} placeholder='请输入真实姓名' onInput={(event) => setName(event.detail.value)} />
          </View>
          <View>
            <Text className='ke-label'>工号</Text>
            <Input className='ke-input' value={staffNo} placeholder='请输入服务工号' onInput={(event) => setStaffNo(event.detail.value)} />
          </View>
          <View>
            <Text className='ke-label'>所属机构</Text>
            <Input className='ke-input' value={organization} placeholder='请输入机构名称' onInput={(event) => setOrganization(event.detail.value)} />
          </View>
          <View>
            <Text className='ke-label'>手机号</Text>
            <Input className='ke-input' type='number' value={phone} placeholder='请输入认证手机号' onInput={(event) => setPhone(event.detail.value)} />
          </View>
          <Button className='service-button service-button--primary' loading={saving} onClick={() => void handleSubmit()}>
            提交认证
          </Button>
        </View>
      </View>
    </View>
  );
}
