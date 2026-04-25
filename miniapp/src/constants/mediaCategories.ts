export const memoryCategoryOptions = ['亲情', '旅行', '节日', '日常'] as const;

export type MemoryCategory = (typeof memoryCategoryOptions)[number];
