import { useMemo } from 'react';
import Taro from '@tarojs/taro';

type InlineStyle = Record<string, string>;

export interface NavigationMetrics {
  statusBarHeight: number;
  navBarHeight: number;
  safeRight: number;
  topbarStyle: InlineStyle;
  heroStyle: InlineStyle;
}

function toPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getNavigationMetrics(): NavigationMetrics {
  const systemInfo = Taro.getSystemInfoSync();
  const statusBarHeight = toPositiveNumber(systemInfo.statusBarHeight, 24);
  const windowWidth = toPositiveNumber(systemInfo.windowWidth, 375);

  let capsuleHeight = 32;
  let capsuleTop = statusBarHeight + 4;
  let safeRight = 32;

  try {
    if (typeof Taro.getMenuButtonBoundingClientRect === 'function') {
      const rect = Taro.getMenuButtonBoundingClientRect();
      capsuleHeight = toPositiveNumber(rect?.height, capsuleHeight);
      capsuleTop = toPositiveNumber(rect?.top, capsuleTop);
      safeRight = Math.max(windowWidth - toPositiveNumber(rect?.left, windowWidth - safeRight) + 12, 32);
    }
  } catch (error) {
    console.warn('Failed to read menu button metrics', error);
  }

  const verticalGap = Math.max(capsuleTop - statusBarHeight, 6);
  const navBarHeight = capsuleHeight + verticalGap * 2;

  return {
    statusBarHeight,
    navBarHeight,
    safeRight,
    topbarStyle: {
      paddingTop: `${statusBarHeight + 10}px`,
      paddingRight: `${safeRight}px`,
      minHeight: `${statusBarHeight + navBarHeight}px`,
    },
    heroStyle: {
      paddingTop: `${statusBarHeight + 18}px`,
      paddingRight: `${safeRight}px`,
    },
  };
}

export function useNavigationMetrics() {
  return useMemo(() => getNavigationMetrics(), []);
}
