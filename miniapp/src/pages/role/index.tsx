import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';

type RoleKey = 'elderly' | 'family' | 'service';

interface RoleCard {
  id: RoleKey;
  title: string;
  description: string;
  icon: string;
}

const roles: RoleCard[] = [
  {
    id: 'elderly',
    title: '老人陪伴端',
    description: '简单好用，温暖陪伴',
    icon: '长',
  },
  {
    id: 'family',
    title: '家属照护端',
    description: '远程守护，及时牵挂',
    icon: '家',
  },
  {
    id: 'service',
    title: '服务协同端',
    description: '仅限认证服务人员使用',
    icon: '护',
  },
];

export default function RolePage() {
  const openLogin = (role: RoleKey) => {
    void Taro.navigateTo({ url: `/pages/login/index?role=${role}` });
  };

  return (
    <View className='role-page'>
      <View className='role-hero'>
        <View className='role-logo'>
          <Text className='role-logo__text'>心</Text>
        </View>
        <Text className='role-title'>心安关怀</Text>
      </View>

      <View className='role-list'>
        {roles.map((role) => (
          <Button
            key={role.id}
            className={`role-card role-card--${role.id}`}
            onClick={() => openLogin(role.id)}
          >
            <View className='role-card__icon'>
              <Text>{role.icon}</Text>
            </View>
            <View className='role-card__body'>
              <Text className='role-card__title'>{role.title}</Text>
              <Text className='role-card__desc'>{role.description}</Text>
            </View>
          </Button>
        ))}
      </View>

      <Text className='role-footer'>安全可靠·易用</Text>
    </View>
  );
}
