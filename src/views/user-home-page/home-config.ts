import type { ParticleItem } from "./type";

export const subtitleTexts = [
  "在代码与灵感之间，持续探索。",
  "把每一次 Bug，都变成成长的注脚。",
  "保持好奇，认真写好每一行代码。",
  "用简单的代码，解决真实的问题。",
];

// 固定参数避免每次渲染产生不同位置，也避免引入粒子库。
export const heroParticles: ParticleItem[] = Array.from({ length: 18 }, (_, index) => ({
  left: (index * 37 + 9) % 96,
  top: (index * 53 + 13) % 88,
  size: 2 + (index % 3),
  duration: 6 + (index % 5),
  delay: -(index % 7),
}));
