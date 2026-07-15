export interface ArticleList {
  id?: string | number;
  oid?: string | number;
  title: string;
  tag: string;
  createTime: string;
  isLike: boolean;
  summary: string;
  coverUrl?: string;
}

export interface BlogData {
  list: ArticleList[];
  current: number;
  size: number;
  total: number;
  tabActive: number;
}

export interface ParticleItem {
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
}
