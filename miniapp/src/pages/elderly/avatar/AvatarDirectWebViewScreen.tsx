import { WebView } from '@tarojs/components';
import { DIGITAL_HUMAN_WEB_URL } from '@/config/runtime';
import { getElderlySession } from '@/utils/session';

interface AvatarDirectWebViewScreenProps {
  stageOnly?: boolean;
}

function appendQuery(url: string, params: Record<string, string>) {
  const separator = url.includes('?') ? '&' : '?';
  const query = Object.entries(params)
    .filter(([, value]) => value.trim() !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${url}${separator}${query}`;
}

export function AvatarDirectWebViewScreen({ stageOnly = false }: AvatarDirectWebViewScreenProps) {
  const { familyId, elderName } = getElderlySession();
  const src = appendQuery(DIGITAL_HUMAN_WEB_URL, {
    source: 'miniapp',
    familyId,
    elderName,
    layout: 'stage-only',
    direct: '1',
    acceleration: 'hardware',
    build: 'xmov-latest-direct-20260414',
  });

  return <WebView src={src} />;
}
