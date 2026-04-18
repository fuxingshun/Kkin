import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';

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

  const handleLogin = () => {
    void Taro.redirectTo({ url: config.targetUrl });
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
              <Text className='login-link'>忘记密码？</Text>
            </View>

            <Button className='login-submit' onClick={handleLogin}>
              立即登录
            </Button>

            {isElderlyMode ? (
              <View className='login-note'>
                <Text>首次使用可联系家人帮助设置</Text>
              </View>
            ) : (
              <View className='login-register'>
                <Text>还没有账号？</Text>
                <Text className='login-link'>立即注册</Text>
              </View>
            )}
          </View>
        </View>

        <Text className='login-safe'>您的信息将被安全加密保护</Text>
      </View>
    </View>
  );
}
