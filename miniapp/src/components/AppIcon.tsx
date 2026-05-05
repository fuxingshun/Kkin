import { View } from '@tarojs/components';

export type AppIconName =
  | 'home'
  | 'heart'
  | 'image'
  | 'user'
  | 'users'
  | 'dashboard'
  | 'message'
  | 'shield'
  | 'bell'
  | 'briefcase'
  | 'case'
  | 'calendar'
  | 'phone'
  | 'video'
  | 'text'
  | 'search'
  | 'check'
  | 'star'
  | 'chevron-left'
  | 'chevron-right'
  | 'more'
  | 'refresh'
  | 'share'
  | 'card'
  | 'location'
  | 'clock'
  | 'book'
  | 'play'
  | 'help'
  | 'close';

interface AppIconProps {
  name: AppIconName;
  className?: string;
}

export function AppIcon({ name, className = '' }: AppIconProps) {
  return (
    <View className={`ke-icon ke-icon--${name} ${className}`}>
      <View className='ke-icon__part ke-icon__part--a' />
      <View className='ke-icon__part ke-icon__part--b' />
      <View className='ke-icon__part ke-icon__part--c' />
    </View>
  );
}
