import type { PropsWithChildren, ReactNode } from 'react';
import { Text, View } from '@tarojs/components';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  caption?: string;
  extra?: ReactNode;
}

export function SectionCard({ title, caption, extra, children }: SectionCardProps) {
  return (
    <View className='ke-section ke-section-card'>
      <View className='ke-section-head'>
        <View>
          <Text className='ke-section-title'>{title}</Text>
          {caption ? <Text className='ke-section-caption'>{caption}</Text> : null}
        </View>
        {extra}
      </View>
      {children}
    </View>
  );
}
