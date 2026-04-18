import { Text, View } from '@tarojs/components';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <View className='ke-stat'>
      <Text className='ke-stat__label'>{label}</Text>
      <Text className='ke-stat__value'>{value}</Text>
      {hint ? <Text className='ke-stat__hint'>{hint}</Text> : null}
    </View>
  );
}
