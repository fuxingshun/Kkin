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
    title: '长辈',
    description: '记录心情，关注健康',
    icon: '长',
  },
  {
    id: 'family',
    title: '家人',
    description: '陪伴长辈，共同关怀',
    icon: '家',
  },
  {
    id: 'service',
    title: '服务人员',
    description: '提供服务，协同守护',
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
        <Text className='role-subtitle'>关注情绪·守护睡眠·日常关怀</Text>
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
