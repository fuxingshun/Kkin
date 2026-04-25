import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { API_BASE_URL, API_BASE_URLS } from '@/config/runtime';
import { login } from '@/services/auth';
import { clearFamilySession, saveFamilySession } from '@/utils/familySession';
import { clearServiceSession, saveServiceSession } from '@/utils/serviceSession';
import { clearElderlySession, saveElderlySession } from '@/utils/session';

type RoleKey = 'elderly' | 'family' | 'service';

interface LoginRoleConfig {
  title: string;
  subtitle: string;
  icon: string;
  targetUrl: string;
}

const roleConfig: Record<RoleKey, LoginRoleConfig> = {
  elderly: {
    title: '老人陪伴端',
    subtitle: '温暖陪伴，记录生活',
    icon: '心',
    targetUrl: '/pages/elderly/home/index',
  },
  family: {
    title: '家属照护端',
    subtitle: '远程守护，安心照护',
    icon: '家',
    targetUrl: '/pages/family/dashboard/index',
  },
  service: {
    title: '服务人员端',
    subtitle: '专业服务，高效协同',
    icon: '协',
    targetUrl: '/pages/service/workspace/index',
  },
};

function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === 'string' && value in roleConfig;
}

export default function LoginPage() {
  const routeRole = Taro.getCurrentInstance().router?.params?.role;
  const role = isRoleKey(routeRole) ? routeRole : 'elderly';
  const config = roleConfig[role];
  const isElderlyMode = role === 'elderly';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    const nextUsername = username.trim();
    const nextPassword = password.trim();

    if (!nextUsername) {
      Taro.showToast({ title: '请输入用户名', icon: 'none' });
      return;
    }

    if (!nextPassword) {
      Taro.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    try {
      setSubmitting(true);
      Taro.showLoading({ title: '正在登录', mask: true });
      const result = await login(role, nextUsername, nextPassword);
      clearElderlySession();
      clearFamilySession();
      clearServiceSession();

      if (role === 'elderly') {
        saveElderlySession({
          role: 'elderly',
          familyId: result.family_id,
          elderlyId: result.elderly_id,
          elderName: result.elderly_name || result.display_name || nextUsername,
        });
      } else if (role === 'family') {
        saveFamilySession({
          familyId: result.family_id,
          familyUserId: result.family_user_id || result.user_id,
          familyName: result.family_name || result.display_name || nextUsername,
          elderlyId: result.elderly_id,
          elderlyName: result.elderly_name,
        });
      } else {
        saveServiceSession({
          username: result.username || nextUsername,
          familyId: result.family_id,
          displayName: result.display_name || '服务专员',
        });
      }

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

  return (
    <View className={`login-page login-page--${role}`}>
      <View className='login-shell'>
        <Button className='login-back' onClick={returnToRole}>
          返回角色选择
        </Button>

        <View className='login-card'>
          <View className='login-card__head'>
            <View className='login-card__icon'>
              <Text>{config.icon}</Text>
            </View>
            <Text className={isElderlyMode ? 'login-title login-title--large' : 'login-title'}>
              {config.title}
            </Text>
            <Text className='login-subtitle'>{config.subtitle}</Text>
          </View>

          <View className='login-form'>
            <View className='login-field'>
              <Text className={isElderlyMode ? 'login-label login-label--large' : 'login-label'}>用户名</Text>
              <Input
                className={isElderlyMode ? 'login-input login-input--large' : 'login-input'}
                value={username}
                placeholder={isElderlyMode ? '请输入您的用户名' : '请输入用户名'}
                onInput={(event) => setUsername(event.detail.value)}
              />
            </View>

            <View className='login-field'>
              <Text className={isElderlyMode ? 'login-label login-label--large' : 'login-label'}>密码</Text>
              <View className='login-password'>
                <Input
                  className={isElderlyMode ? 'login-input login-input--large' : 'login-input'}
                  value={password}
                  password={!showPassword}
                  placeholder={isElderlyMode ? '请输入您的密码' : '请输入密码'}
                  onInput={(event) => setPassword(event.detail.value)}
                />
                <Text className='login-password__toggle' onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? '隐藏' : '显示'}
                </Text>
              </View>
            </View>

            <View className='login-row'>
              <View className='login-check' onClick={() => setRemember((value) => !value)}>
                <View className={remember ? 'login-check__box login-check__box--active' : 'login-check__box'}>
                  {remember ? <Text>✓</Text> : null}
                </View>
                <Text>记住我</Text>
              </View>
              <Text
                className='login-link'
                onClick={() =>
                  Taro.showModal({
                    title: '忘记密码',
                    content: role === 'service' ? '请联系管理员重置服务端账号密码。' : '演示环境默认密码可使用手机号后 6 位，或联系管理员重置。',
                    showCancel: false,
                  })
                }
              >
                忘记密码？
              </Text>
            </View>

            <Button className='login-submit' loading={submitting} onClick={() => void handleLogin()}>
              立即登录
            </Button>

            {isElderlyMode ? (
              <View className='login-note'>
                <Text>演示环境默认密码可使用手机号后 6 位</Text>
              </View>
            ) : (
              <View className='login-register'>
                <Text>还没有账号？</Text>
                <Text
                  className='login-link'
                  onClick={() =>
                    Taro.showModal({
                      title: '账号开通',
                      content: role === 'service' ? '服务端账号请由平台管理员开通。' : '家属账号可先由老人端生成绑定码，再在家属端完成绑定。',
                      showCancel: false,
                    })
                  }
                >
                  立即注册
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text className='login-safe'>您的信息将被安全加密保护</Text>
      </View>
    </View>
  );
}
