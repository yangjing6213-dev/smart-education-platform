export interface VisitorActivity {
  readonly id: string;
  readonly date: string;
  readonly category: string;
  readonly title: string;
  readonly summary: string;
  readonly details: readonly string[];
  readonly isSynthetic: true;
}

export const VISITOR_ACTIVITIES: readonly VisitorActivity[] = [
  {
    id: "sample-art-table",
    date: "2026-10-20",
    category: "动手创作",
    title: "一起动手做创作",
    summary: "用颜色和想象力，完成一件属于自己的小作品。",
    details: [
      "活动示例：认识不同材料，选择喜欢的颜色，再把想法慢慢做出来。",
      "作品和活动安排均为虚构示例，不代表任何真实学员或校区活动。",
    ],
    isSynthetic: true,
  },
  {
    id: "sample-reading-time",
    date: "2026-10-18",
    category: "阅读分享",
    title: "小小阅读时光",
    summary: "选一本喜欢的故事，和伙伴分享印象深刻的片段。",
    details: [
      "活动示例：安静阅读、挑选喜欢的片段，再练习用自己的话分享。",
      "活动内容为虚构示例，不包含真实学员信息。",
    ],
    isSynthetic: true,
  },
  {
    id: "sample-green-discovery",
    date: "2026-10-12",
    category: "自然观察",
    title: "发现身边的绿意",
    summary: "观察叶片的形状和颜色，练习认真记录新发现。",
    details: [
      "活动示例：观察常见植物的外形，画下发现，并交流照顾植物的方法。",
      "活动内容为虚构示例，不代表真实地点、学员或活动记录。",
    ],
    isSynthetic: true,
  },
];

export function filterVisitorActivities(
  activities: readonly VisitorActivity[],
  date: string,
): readonly VisitorActivity[] {
  if (date.length === 0) return activities;
  return activities.filter((activity) => activity.date === date);
}

export function getVisitorActivity(id: string): VisitorActivity | undefined {
  return VISITOR_ACTIVITIES.find((activity) => activity.id === id);
}
