export function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatDateTimeValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:00`;
}

export function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTimeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function combineDateTime(dateValue: string, timeValue: string) {
  return `${dateValue} ${timeValue}:00`;
}

export function formatDateTimeText(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

export function formatTimeText(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatRelativeTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;

  return `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`;
}

export function isSoon(value: string, minutes = 30) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const diff = date.getTime() - Date.now();
  return diff > 0 && diff <= minutes * 60 * 1000;
}

export function formatDurationSeconds(value?: number) {
  if (!value || value <= 0) {
    return '不足 1 秒';
  }

  if (value < 60) {
    return `${value} 秒`;
  }

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  if (!seconds) {
    return `${minutes} 分钟`;
  }

  return `${minutes} 分 ${seconds} 秒`;
}
