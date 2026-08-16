import React, { createContext, useState, useContext, ReactNode } from 'react';

// 定义榜单数据类型
export interface RankingItem {
  id: string;
  rank: number;
  title: string;
  artist: string;
  coverUrl: string;
  review: string;
  originalScore: number;
  integrity: number;
  durability: number;
  finalScore: number;
}

// 定义Context类型
interface RankingContextType {
  rankingMode: string;
  setRankingMode: (mode: string) => void;
  rankingList: RankingItem[];
  setRankingList: (list: RankingItem[]) => void;
}

// 创建Context
export const RankingContext = createContext<RankingContextType | undefined>(undefined);

// 定义Context Provider组件的props
interface RankingProviderProps {
  children: ReactNode;
}

// 默认榜单数据
export const DEFAULT_RANKING_LIST: RankingItem[] = [
  {
    id: '1',
    rank: 1,
    title: "冠军专辑/单曲",
    artist: "歌手名",
    coverUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E",
    review: "你的评论",
    originalScore: 98,
    integrity: 1.5,
    durability: 2.0,
    finalScore: 0
  },
  {
    id: '2',
    rank: 2,
    title: "亚军专辑/单曲",
    artist: "歌手名",
    coverUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E",
    review: "你的评论",
    originalScore: 96,
    integrity: 1.0,
    durability: 1.5,
    finalScore: 0
  },
  {
    id: '3',
    rank: 3,
    title: "季军专辑/单曲",
    artist: "歌手名",
    coverUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E",
    review: "你的评论",
    originalScore: 94,
    integrity: 1.5,
    durability: 1.0,
    finalScore: 0
  }
];

// 创建Context Provider组件

export const RankingProvider: React.FC<RankingProviderProps> = ({ children }) => {
  // 默认榜单类型
  const [rankingMode, setRankingMode] = useState('年度专辑榜');
  
  // 默认榜单数据
  const [rankingList, setRankingList] = useState<RankingItem[]>(DEFAULT_RANKING_LIST);

  return (
    <RankingContext.Provider value={{ rankingMode, setRankingMode, rankingList, setRankingList }}>
      {children}
    </RankingContext.Provider>
  );
};

// 创建自定义Hook，方便组件使用Context
export const useRankingContext = () => {
  const context = useContext(RankingContext);
  if (context === undefined) {
    throw new Error('useRankingContext must be used within a RankingProvider');
  }
  return context;
};
