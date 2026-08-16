import React, { createContext, useState, useContext, ReactNode } from 'react';

// 搜索上下文类型定义
interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any | null;
  setSearchResults: (results: any | null) => void;
  activeTab: 'songs';
  setActiveTab: (tab: 'songs') => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalResults: number;
  setTotalResults: (total: number) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

// 创建上下文
const SearchContext = createContext<SearchContextType | undefined>(undefined);

// 上下文提供者组件
interface SearchProviderProps {
  children: ReactNode;
}

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'songs'>('songs');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);

  const value: SearchContextType = {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    activeTab,
    setActiveTab,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalResults,
    setTotalResults,
    loading,
    setLoading
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
};

// 自定义钩子，用于在组件中使用上下文
export const useSearch = (): SearchContextType => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
