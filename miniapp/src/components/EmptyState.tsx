import { Text, View } from '@tarojs/components';

interface EmptyStateProps {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <View className='ke-empty'>
      <Text>{title}</Text>
      {hint ? (
        <View>
          <Text className='ke-footnote'>{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}
