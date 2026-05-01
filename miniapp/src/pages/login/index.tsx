import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { API_BASE_URL, API_BASE_URLS } from '@/config/runtime';
import { loginWithWechat, type LoginResult, type WechatProfile } from '@/services/auth';
import { clearFamilySession, saveFamilySession } from '@/utils/familySession';
import { clearServiceSession, saveServiceSession } from '@/utils/serviceSession';
import { clearElderlySession, saveElderlySession } from '@/utils/session';

type RoleKey = 'elderly' | 'family' | 'service';

interface LoginRoleConfig {
  title: string;
  slogan: string;
  icon: string;
  targetUrl: string;
  fallbackName: string;
}

const roleConfig: Record<RoleKey, LoginRoleConfig> = {
  elderly: {
    title: '老人陪伴端',
    slogan: '温暖陪伴每一天',
    icon: '♡',
    targetUrl: '/pages/elderly/home/index',
    fallbackName: '老人用户',
  },
  family: {
    title: '家属照护端',
    slogan: '远程守护，爱不缺席',
    icon: '人',
    targetUrl: '/pages/family/dashboard/index',
    fallbackName: '家属用户',
  },
  service: {
    title: '服务协同端',
    slogan: '专业服务，用心守护',
    icon: '▭',
    targetUrl: '/pages/service/workspace/index',
    fallbackName: '服务专员',
  },
};

function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === 'string' && value in roleConfig;
}

function saveRoleSession(role: RoleKey, result: LoginResult, fallbackName: string) {
  clearElderlySession();
  clearFamilySession();
  clearServiceSession();

  if (role === 'elderly') {
    saveElderlySession({
      role: 'elderly',
      familyId: result.family_id,
      elderlyId: result.elderly_id,
      elderName: result.elderly_name || result.display_name || fallbackName,
    });
    return;
  }

  if (role === 'family') {
    saveFamilySession({
      familyId: result.family_id,
      familyUserId: result.family_user_id || result.user_id,
      familyName: result.family_name || result.display_name || fallbackName,
      elderlyId: result.elderly_id,
      elderlyName: result.elderly_name,
    });
    return;
  }

  saveServiceSession({
    username: result.username || 'wechat-service',
    familyId: result.family_id,
    displayName: result.display_name || fallbackName,
  });
}

async function getWechatProfile(): Promise<WechatProfile | undefined> {
  try {
    const profile = await Taro.getUserProfile({
      desc: '用于完善登录资料',
      lang: 'zh_CN',
    });

    return {
      nickName: profile.userInfo?.nickName,
      avatarUrl: profile.userInfo?.avatarUrl,
    };
  } catch {
    return undefined;
  }
}

export default function LoginPage() {
  const routeRole = Taro.getCurrentInstance().router?.params?.role;
  const role = isRoleKey(routeRole) ? routeRole : 'elderly';
  const config = roleConfig[role];
  const isElderlyMode = role === 'elderly';
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleWechatLogin = async () => {
    if (!agreed) {
      Taro.showModal({
        title: '请先阅读并同意',
        content: '登录前需要同意《用户协议》和《隐私政策》。',
        showCancel: false,
      });
      return;
    }

    try {
      setSubmitting(true);
      const profile = await getWechatProfile();
      Taro.showLoading({ title: '正在登录', mask: true });
      const result = await loginWithWechat(role, profile);

      saveRoleSession(role, result, profile?.nickName || config.fallbackName);

      Taro.hideLoading();
      Taro.showToast({ title: '登录成功', icon: 'success' });
      await Taro.redirectTo({ url: config.targetUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败';
      Taro.hideLoading();
      Taro.showModal({
        title: '登录失败',
        content: `${message}\n\n默认接口：${API_BASE_URL}\n候选地址：${API_BASE_URLS.length} 个`,
        showCancel: false,
      });
    } finally {
      Taro.hideLoading();
      setSubmitting(false);
    }
  };

  const returnToRole = () => {
    void Taro.navigateBack({
      fail: () => Taro.redirectTo({ url: '/pages/role/index' }),
    });
  };

  const showPolicy = (title: string) => {
    Taro.showModal({
      title,
      content: '我们会按照微信小程序规范，仅在登录和服务履约所需范围内使用您的授权信息。',
      showCancel: false,
    });
  };

  return (
    <View className={`login-page login-page--${role}`}>
      <View className='login-shell'>
        <Button className='login-back' onClick={returnToRole}>
          <Text className='login-back__icon'>‹</Text>
          <Text>返回</Text>
        </Button>

        <View className='login-main'>
          <View className={`login-card__icon login-card__icon--${role}`}>
            <Text className='login-card__icon-text'>{config.icon}</Text>
          </View>

          <Text className={isElderlyMode ? 'login-title login-title--large' : 'login-title'}>
            {config.title}
          </Text>
          <Text className={isElderlyMode ? 'login-subtitle login-subtitle--large' : 'login-subtitle'}>
            {config.slogan}
          </Text>

          <Button
            className={isElderlyMode ? 'login-submit login-submit--large' : 'login-submit'}
            disabled={submitting}
            onClick={() => void handleWechatLogin()}
          >
            {submitting ? (
              <View className='login-spinner' />
            ) : (
              <View className='login-wechat-mark'>
                <Text>微</Text>
              </View>
            )}
            <Text>{submitting ? '正在授权...' : '微信授权登录'}</Text>
          </Button>

          {isElderlyMode && (
            <View className='login-note'>
              <Text>点击上方按钮即可使用微信登录</Text>
            </View>
          )}
        </View>

        <View className='login-bottom'>
          <View className='login-agree' onClick={() => setAgreed((value) => !value)}>
            <View className={agreed ? 'login-check__box login-check__box--active' : 'login-check__box'}>
              <Text>{agreed ? '✓' : ''}</Text>
            </View>
            <View className='login-agree__text'>
              <Text>登录即代表同意</Text>
              <Text
                className='login-policy-link'
                onClick={(event) => {
                  event.stopPropagation();
                  showPolicy('用户协议');
                }}
              >
                《用户协议》
              </Text>
              <Text>和</Text>
              <Text
                className='login-policy-link'
                onClick={(event) => {
                  event.stopPropagation();
                  showPolicy('隐私政策');
                }}
              >
                《隐私政策》
              </Text>
            </View>
          </View>

          <View className='login-safe'>
            <Text className='login-safe__icon'>锁</Text>
            <Text>您的个人信息将被安全加密保护</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
