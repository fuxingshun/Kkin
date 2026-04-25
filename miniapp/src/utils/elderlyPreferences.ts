import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { useDidShow } from '@tarojs/taro';

export type ElderlyFontSize = 'normal' | 'large' | 'extraLarge';
export type ElderlyLanguage = '普通话' | '粤语' | '四川话' | '上海话';
export type ElderlyAiPersona = '温柔陪伴' | '活力鼓励' | '耐心倾听' | '简洁提醒';

export interface ElderlyPreferences {
  fontSize: ElderlyFontSize;
  highContrast: boolean;
  voiceBroadcast: boolean;
  language: ElderlyLanguage;
  aiPersona: ElderlyAiPersona;
}

const ELDERLY_PREFERENCES_KEY = 'kin-elderly-preferences';
const ELDERLY_PREFERENCES_CHANGED_EVENT = 'kin-elderly-preferences-changed';

export const elderlyFontSizeOptions: Array<{ label: string; value: ElderlyFontSize }> = [
  { label: '标准', value: 'normal' },
  { label: '大号', value: 'large' },
  { label: '特大号', value: 'extraLarge' },
];

export const elderlyLanguageOptions: ElderlyLanguage[] = ['普通话', '粤语', '四川话', '上海话'];

export const elderlyAiPersonaOptions: ElderlyAiPersona[] = [
  '温柔陪伴',
  '活力鼓励',
  '耐心倾听',
  '简洁提醒',
];

export const defaultElderlyPreferences: ElderlyPreferences = {
  fontSize: 'large',
  highContrast: true,
  voiceBroadcast: true,
  language: '普通话',
  aiPersona: '温柔陪伴',
};

function normalizeFontSize(value: unknown): ElderlyFontSize {
  return elderlyFontSizeOptions.some((item) => item.value === value)
    ? (value as ElderlyFontSize)
    : defaultElderlyPreferences.fontSize;
}

function normalizeLanguage(value: unknown): ElderlyLanguage {
  return elderlyLanguageOptions.includes(value as ElderlyLanguage)
    ? (value as ElderlyLanguage)
    : defaultElderlyPreferences.language;
}

function normalizeAiPersona(value: unknown): ElderlyAiPersona {
  return elderlyAiPersonaOptions.includes(value as ElderlyAiPersona)
    ? (value as ElderlyAiPersona)
    : defaultElderlyPreferences.aiPersona;
}

export function getElderlyPreferences(): ElderlyPreferences {
  const stored = Taro.getStorageSync(ELDERLY_PREFERENCES_KEY) as Partial<ElderlyPreferences> | undefined;

  return {
    fontSize: normalizeFontSize(stored?.fontSize),
    highContrast:
      typeof stored?.highContrast === 'boolean'
        ? stored.highContrast
        : defaultElderlyPreferences.highContrast,
    voiceBroadcast:
      typeof stored?.voiceBroadcast === 'boolean'
        ? stored.voiceBroadcast
        : defaultElderlyPreferences.voiceBroadcast,
    language: normalizeLanguage(stored?.language),
    aiPersona: normalizeAiPersona(stored?.aiPersona),
  };
}

export function saveElderlyPreferences(patch: Partial<ElderlyPreferences>) {
  const next: ElderlyPreferences = {
    ...getElderlyPreferences(),
    ...patch,
  };

  Taro.setStorageSync(ELDERLY_PREFERENCES_KEY, next);
  Taro.eventCenter.trigger(ELDERLY_PREFERENCES_CHANGED_EVENT, next);
  return next;
}

export function getElderlyFontSizeLabel(fontSize: ElderlyFontSize) {
  return elderlyFontSizeOptions.find((item) => item.value === fontSize)?.label || '大号';
}

export function getElderlyPreferenceClassNames(preferences: ElderlyPreferences) {
  return [
    preferences.fontSize === 'large' ? 'ef-page--font-large' : '',
    preferences.fontSize === 'extraLarge' ? 'ef-page--font-extra' : '',
    preferences.highContrast ? 'ef-page--high-contrast' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function useElderlyPreferenceClassNames() {
  const [preferences, setPreferences] = useState<ElderlyPreferences>(() => getElderlyPreferences());

  useDidShow(() => {
    setPreferences(getElderlyPreferences());
  });

  useEffect(() => {
    const handler = (nextPreferences?: ElderlyPreferences) => {
      setPreferences(nextPreferences || getElderlyPreferences());
    };

    Taro.eventCenter.on(ELDERLY_PREFERENCES_CHANGED_EVENT, handler);
    return () => {
      Taro.eventCenter.off(ELDERLY_PREFERENCES_CHANGED_EVENT, handler);
    };
  }, []);

  return getElderlyPreferenceClassNames(preferences);
}
