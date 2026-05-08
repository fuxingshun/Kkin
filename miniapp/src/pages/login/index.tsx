import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { API_BASE_URL, API_BASE_URLS } from '@/config/runtime';
import {
  openWechatSession,
  queryWechatIdentity,
  recordLoginConsent,
  type WechatIdentityStatus,
  type WechatProfile,
} from '@/services/auth';
import { clearFamilySession, saveFamilySession } from '@/utils/familySession';
import { clearServiceSession, saveServiceSession } from '@/utils/serviceSession';
import { clearElderlySession, saveElderlySession } from '@/utils/session';

type RoleKey = 'elderly' | 'family' | 'service';
const LOGIN_CONSENT_VERSION = 'pilot-v1';

interface LoginRoleConfig {
  title: string;
  slogan: string;
  icon: string;
  fallbackName: string;
}

const roleConfig: Record<RoleKey, LoginRoleConfig> = {
  elderly: {
    title: '老人陪伴端',
    slogan: '简单好用，温暖陪伴每一天',
    icon: '♡',
    fallbackName: '老人用户',
  },
  family: {
    title: '家属照护端',
    slogan: '远程守护，爱不缺席',
    icon: '人',
    fallbackName: '家属用户',
  },
  service: {
    title: '服务协同端',
    slogan: '仅限认证服务人员使用',
    icon: '▭',
    fallbackName: '服务专员',
  },
};

function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === 'string' && value in roleConfig;
}

function clearRoleSessions() {
  clearElderlySession();
  clearFamilySession();
  clearServiceSession();
}

function saveVerifiedSession(role: RoleKey, identity: WechatIdentityStatus, fallbackName: string) {
  clearRoleSessions();

  if (role === 'elderly') {
    const elderly = identity.elderly;
    saveElderlySession({
      role: 'elderly',
      familyId: elderly.family_id,
      elderlyId: elderly.user_id,
      elderName: elderly.name || elderly.display_name || fallbackName,
      wechatOpenid: identity.openid,
      sessionToken: elderly.session_token,
    });
    return;
  }

  if (role === 'family') {
    const family = identity.family;
    saveFamilySession({
      familyId: family.family_id,
      familyUserId: family.family_user_id || family.user_id,
      familyName: family.name || family.display_name || fallbackName,
      elderlyId: family.elderly_id,
      elderlyName: family.elderly_name,
      wechatOpenid: identity.openid,
      sessionToken: family.session_token,
    });
    return;
  }

  const service = identity.service;
  saveServiceSession({
    username: service.username || 'wechat-service',
    familyId: service.family_id,
    displayName: service.display_name || fallbackName,
    wechatOpenid: identity.openid,
    sessionToken: service.session_token,
    certificationStatus: service.status,
  });
}

async function recordVerifiedLoginConsents(role: RoleKey, identity: WechatIdentityStatus, fallbackName: string) {
  const baseMetadata = {
    role,
    agreement_pages: ['/pages/legal/user-agreement/index', '/pages/legal/privacy-policy/index'],
  };

  const payload =
    role === 'elderly'
      ? {
          family_id: identity.elderly.family_id || '',
          elderly_id: identity.elderly.user_id,
          user_id: identity.elderly.user_id,
          actor_role: role,
          actor_name: identity.elderly.name || identity.elderly.display_name || fallbackName,
          metadata: baseMetadata,
        }
      : role === 'family'
        ? {
            family_id: identity.family.family_id || '',
            elderly_id: identity.family.elderly_id,
            user_id: identity.family.family_user_id || identity.family.user_id,
            actor_role: role,
            actor_name: identity.family.name || identity.family.display_name || fallbackName,
            metadata: baseMetadata,
          }
        : {
            family_id: identity.service.family_id || '',
            actor_role: role,
            actor_name: identity.service.display_name || identity.service.username || fallbackName,
            metadata: {
              ...baseMetadata,
              certification_status: identity.service.status,
            },
          };

  if (!payload.family_id) {
    throw new Error('缺少家庭信息，无法记录协议同意');
  }

  await Promise.all([
    recordLoginConsent({
      ...payload,
      consent_type: 'user-agreement',
      version: LOGIN_CONSENT_VERSION,
    }),
    recordLoginConsent({
      ...payload,
      consent_type: 'privacy-policy',
      version: LOGIN_CONSENT_VERSION,
    }),
  ]);
}

function savePendingEntrance(role: RoleKey, identity: WechatIdentityStatus, fallbackName: string) {
  clearRoleSessions();

  if (role === 'elderly') {
    saveElderlySession({
      role: 'elderly',
      familyId: `family_${identity.openid.slice(-10) || Date.now()}`,
      elderName: fallbackName,
      wechatOpenid: identity.openid,
    });
    return;
  }

  if (role === 'family') {
    saveFamilySession({
      familyName: identity.family.name || fallbackName,
      wechatOpenid: identity.openid,
    });
    return;
  }

  saveServiceSession({
    displayName: identity.service.display_name || fallbackName,
    wechatOpenid: identity.openid,
    certificationStatus: identity.service.status,
  });
}

async function routeAfterIdentity(role: RoleKey, identity: WechatIdentityStatus, fallbackName: string) {
  if (role === 'elderly') {
    if (identity.elderly.has_role) {
      saveVerifiedSession(role, identity, fallbackName);
      try {
        await recordVerifiedLoginConsents(role, identity, fallbackName);
      } catch (error) {
        clearRoleSessions();
        throw error;
      }
      await Taro.redirectTo({ url: '/pages/elderly/home/index' });
      return;
    }

    savePendingEntrance(role, identity, fallbackName);
    await Taro.redirectTo({ url: '/pages/elderly/basic-info/index?mode=create' });
    return;
  }

  if (role === 'family') {
    if (identity.family.has_role && identity.family.bound_elderly) {
      saveVerifiedSession(role, identity, fallbackName);
      try {
        await recordVerifiedLoginConsents(role, identity, fallbackName);
      } catch (error) {
        clearRoleSessions();
        throw error;
      }
      await Taro.redirectTo({ url: '/pages/family/dashboard/index' });
      return;
    }

    savePendingEntrance(role, identity, fallbackName);
    await Taro.redirectTo({ url: '/pages/family/bind-elderly/index?from=login' });
    return;
  }

  if (identity.service.certified && identity.service.status === 'approved') {
    saveVerifiedSession(role, identity, fallbackName);
    try {
      await recordVerifiedLoginConsents(role, identity, fallbackName);
    } catch (error) {
      clearRoleSessions();
      throw error;
    }
    await Taro.redirectTo({ url: '/pages/service/workspace/index' });
    return;
  }

  savePendingEntrance(role, identity, fallbackName);
  if (identity.service.status === 'pending') {
    await Taro.redirectTo({ url: '/pages/service/review-pending/index' });
    return;
  }

  if (identity.service.status === 'rejected') {
    await Taro.redirectTo({ url: '/pages/service/no-access/index?reason=rejected' });
    return;
  }

  await Taro.redirectTo({ url: '/pages/service/certification/index' });
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
      Taro.showLoading({ title: '正在授权', mask: true });
      const session = await openWechatSession(role, profile);

      Taro.showLoading({ title: '正在校验身份', mask: true });
      const identity = await queryWechatIdentity(session.openid);

      Taro.hideLoading();
      await routeAfterIdentity(role, identity, profile?.nickName || config.fallbackName);
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

  const openLegalPage = (url: string) => {
    Taro.navigateTo({ url });
  };

  return (
    <View className={`login-page login-page--${role}`}>
      <View className='login-shell'>
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
                  openLegalPage('/pages/legal/user-agreement/index');
                }}
              >
                《用户协议》
              </Text>
              <Text>和</Text>
              <Text
                className='login-policy-link'
                onClick={(event) => {
                  event.stopPropagation();
                  openLegalPage('/pages/legal/privacy-policy/index');
                }}
              >
                《隐私政策》
              </Text>
            </View>
          </View>

        </View>
      </View>
    </View>
  );
}
